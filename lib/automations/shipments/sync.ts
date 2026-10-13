import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { actionLog, processedMessages, settings, shipments, type ShipmentStatus } from "@/lib/db/schema";
import type { MailProvider } from "@/lib/mail/provider";
import { carrierById, type CarrierId } from "./carriers";
import { extractShipment } from "./extract";

export const AUTOMATION_ID = "shipments";
export const SHIPMENTS_LABEL = "Shipments";
const BACKFILL_DAYS = 14;
const MAX_PER_RUN = 50;
// Bump when extraction rules improve: previously scanned mail is re-evaluated once.
const EXTRACTOR_VERSION = "2";

const KEYWORDS = `shipped OR shipment OR tracking OR "out for delivery" OR delivered OR "on its way"`;
const rank: Record<ShipmentStatus, number> = { shipped: 0, out_for_delivery: 1, delivered: 2 };

export interface SyncResult {
  scanned: number;
  matched: number;
  moved: number;
}

// Overlapping polls (two tabs, slow scans) must not double-process.
const running = new Map<string, Promise<SyncResult>>();

export function syncShipments(provider: MailProvider, db: Db, accountId: string): Promise<SyncResult> {
  const existing = running.get(accountId);
  if (existing) return existing;
  const p = run(provider, db, accountId).finally(() => running.delete(accountId));
  running.set(accountId, p);
  return p;
}

function getSetting(db: Db, accountId: string, key: string): string | undefined {
  return db
    .select()
    .from(settings)
    .where(and(eq(settings.accountId, accountId), eq(settings.key, key)))
    .get()?.value;
}

function setSetting(db: Db, accountId: string, key: string, value: string) {
  db.insert(settings)
    .values({ accountId, key, value })
    .onConflictDoUpdate({ target: [settings.accountId, settings.key], set: { value } })
    .run();
}

export async function getShipmentsLabelId(provider: MailProvider, db: Db, accountId: string) {
  const cached = getSetting(db, accountId, "shipmentsLabelId");
  if (cached) return cached;
  const id = await provider.ensureLabel(SHIPMENTS_LABEL);
  setSetting(db, accountId, "shipmentsLabelId", id);
  return id;
}

async function run(provider: MailProvider, db: Db, accountId: string): Promise<SyncResult> {
  const labelId = await getShipmentsLabelId(provider, db, accountId);
  if (getSetting(db, accountId, "extractorVersion") !== EXTRACTOR_VERSION) {
    // Keep rows for messages the user undid so they are never re-handled.
    db.delete(processedMessages)
      .where(and(eq(processedMessages.accountId, accountId), eq(processedMessages.ignored, false)))
      .run();
    setSetting(db, accountId, "extractorVersion", EXTRACTOR_VERSION);
  }
  const query = `newer_than:${BACKFILL_DAYS}d (${KEYWORDS}) -in:sent -in:drafts -in:trash -in:spam`;
  const ids = await provider.searchMessageIds(query, MAX_PER_RUN);

  const seen = new Set(
    db
      .select({ id: processedMessages.messageId })
      .from(processedMessages)
      .where(and(eq(processedMessages.accountId, accountId), eq(processedMessages.automationId, AUTOMATION_ID)))
      .all()
      .map((r) => r.id),
  );
  const fresh = ids.filter((id) => !seen.has(id));
  const messages = (await Promise.all(fresh.map((id) => provider.getMessage(id)))).sort(
    (a, b) => a.date - b.date, // oldest first so status only moves forward
  );

  const result: SyncResult = { scanned: messages.length, matched: 0, moved: 0 };
  for (const msg of messages) {
    const found = extractShipment(msg);
    db.insert(processedMessages)
      .values({ accountId, messageId: msg.id, automationId: AUTOMATION_ID })
      .onConflictDoNothing()
      .run();
    if (!found) continue;
    result.matched++;

    const now = Date.now();
    const row = db
      .select()
      .from(shipments)
      .where(and(eq(shipments.accountId, accountId), eq(shipments.trackingNumber, found.trackingNumber)))
      .get();
    if (!row) {
      db.insert(shipments)
        .values({
          accountId,
          trackingNumber: found.trackingNumber,
          carrier: found.carrier,
          sender: found.sender,
          status: found.status,
          eta: found.eta,
          threadId: msg.threadId,
          latestMessageId: msg.id,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } else {
      db.update(shipments)
        .set({
          status: rank[found.status] >= rank[row.status] ? found.status : row.status,
          eta: found.eta ?? row.eta,
          latestMessageId: msg.id,
          updatedAt: now,
        })
        .where(eq(shipments.id, row.id))
        .run();
    }

    // Only touch labels that actually change, so undo restores exactly the prior state.
    const add = msg.labelIds.includes(labelId) ? [] : [labelId];
    const remove = ["INBOX", "UNREAD"].filter((l) => msg.labelIds.includes(l));
    if (add.length || remove.length) {
      await provider.modifyMessage(msg.id, { addLabelIds: add, removeLabelIds: remove });
      db.insert(actionLog)
        .values({
          accountId,
          automationId: AUTOMATION_ID,
          messageId: msg.id,
          threadId: msg.threadId,
          summary: `Moved “${msg.subject || "(no subject)"}” to ${SHIPMENTS_LABEL}`,
          addedLabelIds: add,
          removedLabelIds: remove,
          createdAt: now,
        })
        .run();
      result.moved++;
    }
  }
  return result;
}

export async function undoAction(provider: MailProvider, db: Db, accountId: string, actionId: number) {
  const row = db
    .select()
    .from(actionLog)
    .where(and(eq(actionLog.id, actionId), eq(actionLog.accountId, accountId)))
    .get();
  if (!row || row.undoneAt) return false;
  await provider.modifyMessage(row.messageId, {
    addLabelIds: row.removedLabelIds,
    removeLabelIds: row.addedLabelIds,
  });
  db.update(actionLog).set({ undoneAt: Date.now() }).where(eq(actionLog.id, row.id)).run();
  db.update(processedMessages)
    .set({ ignored: true })
    .where(and(eq(processedMessages.accountId, accountId), eq(processedMessages.messageId, row.messageId)))
    .run();
  // If this was the only message behind a shipment, drop it from the dashboard.
  db.update(shipments)
    .set({ dismissed: true })
    .where(and(eq(shipments.accountId, accountId), eq(shipments.latestMessageId, row.messageId)))
    .run();
  return true;
}

export const trackUrl = (carrier: string, n: string) => carrierById(carrier as CarrierId).trackUrl(n);

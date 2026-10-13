import { describe, expect, it, vi } from "vitest";
import { createDb } from "@/lib/db";
import type { MailProvider } from "@/lib/mail/provider";
import type { Message } from "@/lib/mail/types";
import { shipments } from "@/lib/db/schema";
import { syncShipments, undoAction } from "./sync";

const mk = (id: string, date: number, text: string, labelIds = ["INBOX", "UNREAD"]): Message => ({
  id, threadId: `t-${id}`, from: { name: "Some Store", email: "a@store.test" }, to: [], cc: [], date,
  subject: "Order update", html: null, text, attachments: [], labelIds,
});

function fakeProvider(messages: Message[]) {
  const modify = vi.fn(async () => {});
  const provider = {
    ensureLabel: async () => "Label_1",
    searchMessageIds: async () => messages.map((m) => m.id),
    getMessage: async (id: string) => messages.find((m) => m.id === id)!,
    modifyMessage: modify,
  } as unknown as MailProvider;
  return { provider, modify };
}

describe("syncShipments", () => {
  it("creates a shipment, labels/reads the email, and is idempotent", async () => {
    const db = createDb(":memory:");
    const { provider, modify } = fakeProvider([
      mk("m1", 1, "UPS 1Z742W400390007009 has shipped"),
      mk("m2", 2, "Newsletter"),
    ]);
    const r1 = await syncShipments(provider, db, "me@x.com");
    expect(r1).toMatchObject({ scanned: 2, matched: 1, moved: 1 });
    expect(modify).toHaveBeenCalledWith("m1", { addLabelIds: ["Label_1"], removeLabelIds: ["INBOX", "UNREAD"] });
    const r2 = await syncShipments(provider, db, "me@x.com");
    expect(r2.scanned).toBe(0);
    expect(modify).toHaveBeenCalledTimes(1);
  });

  it("a later delivered email updates the same shipment and never regresses status", async () => {
    const db = createDb(":memory:");
    const { provider } = fakeProvider([
      mk("m2", 2, "UPS 1Z742W400390007009 was delivered"),
      mk("m1", 1, "UPS 1Z742W400390007009 has shipped"),
    ]);
    await syncShipments(provider, db, "me@x.com");
    const rows = db.select().from(shipments).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("delivered");
  });

  it("undo restores prior labels", async () => {
    const db = createDb(":memory:");
    const { provider, modify } = fakeProvider([mk("m1", 1, "UPS 1Z742W400390007009 has shipped")]);
    await syncShipments(provider, db, "me@x.com");
    expect(await undoAction(provider, db, "me@x.com", 1)).toBe(true);
    expect(modify).toHaveBeenLastCalledWith("m1", { addLabelIds: ["INBOX", "UNREAD"], removeLabelIds: ["Label_1"] });
    expect(await undoAction(provider, db, "me@x.com", 1)).toBe(false);
  });
});

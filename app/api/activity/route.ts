import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { actionLog } from "@/lib/db/schema";
import { withProvider } from "@/lib/mail/route-helpers";
import { getShipmentsLabelId } from "@/lib/automations/shipments/sync";

export const GET = withProvider<unknown>(async (provider, _req, _ctx, accountId) => {
  const db = getDb();
  const rows = db
    .select()
    .from(actionLog)
    .where(eq(actionLog.accountId, accountId))
    .orderBy(desc(actionLog.createdAt))
    .limit(100)
    .all();
  return NextResponse.json({
    labelId: await getShipmentsLabelId(provider, db, accountId),
    actions: rows.map((r) => ({
      id: r.id,
      summary: r.summary,
      threadId: r.threadId,
      createdAt: r.createdAt,
      undoneAt: r.undoneAt,
    })),
  });
});

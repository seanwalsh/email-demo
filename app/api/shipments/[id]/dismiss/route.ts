import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { shipments } from "@/lib/db/schema";
import { withProvider } from "@/lib/mail/route-helpers";

export const POST = withProvider<{ params: Promise<{ id: string }> }>(
  async (_provider, _req, { params }, accountId) => {
    const { id } = await params;
    getDb()
      .update(shipments)
      .set({ dismissed: true })
      .where(and(eq(shipments.id, Number(id)), eq(shipments.accountId, accountId)))
      .run();
    return NextResponse.json({ ok: true });
  },
);

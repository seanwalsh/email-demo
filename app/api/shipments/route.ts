import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { shipments } from "@/lib/db/schema";
import { withProvider } from "@/lib/mail/route-helpers";
import { carrierById, type CarrierId } from "@/lib/automations/shipments/carriers";
import { getShipmentsLabelId } from "@/lib/automations/shipments/sync";

export const GET = withProvider<unknown>(async (provider, _req, _ctx, accountId) => {
  const db = getDb();
  const rows = db
    .select()
    .from(shipments)
    .where(and(eq(shipments.accountId, accountId), eq(shipments.dismissed, false)))
    .orderBy(desc(shipments.updatedAt))
    .all();
  const labelId = await getShipmentsLabelId(provider, db, accountId);
  return NextResponse.json({
    labelId,
    shipments: rows.map((r) => {
      const carrier = carrierById(r.carrier as CarrierId);
      return {
        id: r.id,
        sender: r.sender,
        carrier: carrier.name,
        trackingNumber: r.trackingNumber,
        trackUrl: carrier.trackUrl(r.trackingNumber),
        status: r.status,
        eta: r.eta,
        threadId: r.threadId,
        updatedAt: r.updatedAt,
      };
    }),
  });
});

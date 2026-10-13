import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { withProvider } from "@/lib/mail/route-helpers";
import { syncShipments } from "@/lib/automations/shipments/sync";

export const POST = withProvider<unknown>(async (provider, _req, _ctx, accountId) =>
  NextResponse.json(await syncShipments(provider, getDb(), accountId)),
);

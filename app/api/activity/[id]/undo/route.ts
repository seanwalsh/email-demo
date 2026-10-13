import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { withProvider } from "@/lib/mail/route-helpers";
import { undoAction } from "@/lib/automations/shipments/sync";

export const POST = withProvider<{ params: Promise<{ id: string }> }>(
  async (provider, _req, { params }, accountId) => {
    const { id } = await params;
    const ok = await undoAction(provider, getDb(), accountId, Number(id));
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  },
);

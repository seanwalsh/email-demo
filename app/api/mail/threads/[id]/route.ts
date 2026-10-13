import { NextResponse } from "next/server";
import { withProvider } from "@/lib/mail/route-helpers";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withProvider<Ctx>(async (provider, _req, { params }) => {
  const { id } = await params;
  return NextResponse.json(await provider.getThread(id));
});

// POST body: { action: "modify", addLabelIds?, removeLabelIds? } | { action: "trash" }
export const POST = withProvider<Ctx>(async (provider, req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  if (body.action === "trash") {
    await provider.trashThread(id);
  } else if (body.action === "modify") {
    await provider.modifyThread(id, {
      addLabelIds: body.addLabelIds,
      removeLabelIds: body.removeLabelIds,
    });
  } else {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
});

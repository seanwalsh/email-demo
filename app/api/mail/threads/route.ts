import { NextResponse } from "next/server";
import { withProvider } from "@/lib/mail/route-helpers";

export const GET = withProvider<unknown>(async (provider, req) => {
  const p = req.nextUrl.searchParams;
  const page = await provider.listThreads({
    labelId: p.get("label") ?? undefined,
    query: p.get("q") ?? undefined,
    pageToken: p.get("pageToken") ?? undefined,
  });
  return NextResponse.json(page);
});

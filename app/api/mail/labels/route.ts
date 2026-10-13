import { NextResponse } from "next/server";
import { withProvider } from "@/lib/mail/route-helpers";

export const GET = withProvider<unknown>(async (provider) =>
  NextResponse.json(await provider.listLabels()),
);

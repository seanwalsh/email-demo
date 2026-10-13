import { NextResponse, type NextRequest } from "next/server";
import type { MailProvider } from "./provider";
import { getMailProvider } from "./session";

export function withProvider<C>(
  handler: (provider: MailProvider, req: NextRequest, ctx: C) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const provider = await getMailProvider(req);
      if (!provider) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      return await handler(provider, req, ctx);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "mail_error" }, { status: 502 });
    }
  };
}

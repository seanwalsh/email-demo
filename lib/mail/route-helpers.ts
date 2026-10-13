import { NextResponse, type NextRequest } from "next/server";
import type { MailProvider } from "./provider";
import { getMailSession } from "./session";

export function withProvider<C>(
  handler: (provider: MailProvider, req: NextRequest, ctx: C, accountId: string) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const session = await getMailSession(req);
      if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      return await handler(session.provider, req, ctx, session.accountId);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "mail_error" }, { status: 502 });
    }
  };
}

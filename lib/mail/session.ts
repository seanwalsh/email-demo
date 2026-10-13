import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { GmailProvider } from "./gmail";
import type { MailProvider } from "./provider";

// Short-lived cache so a burst of requests doesn't each hit Google's token endpoint.
const refreshed = new Map<string, { accessToken: string; expiresAt: number }>();

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const cached = refreshed.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error("token_refresh_failed");
  const json = (await res.json()) as { access_token: string; expires_in: number };
  refreshed.set(refreshToken, {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  return json.access_token;
}

export interface MailSession {
  provider: MailProvider;
  accountId: string;
}

export async function getMailSession(req: NextRequest): Promise<MailSession | null> {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.accessToken || !token.email) return null;

  let accessToken = token.accessToken as string;
  const expiresAt = (token.expiresAt as number | undefined) ?? 0;
  if (expiresAt * 1000 < Date.now() + 30_000) {
    if (!token.refreshToken) return null;
    accessToken = await refreshAccessToken(token.refreshToken as string);
  }
  return { provider: new GmailProvider(accessToken), accountId: token.email };
}

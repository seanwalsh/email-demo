import { google, type gmail_v1 } from "googleapis";
import type { MailProvider } from "./provider";
import { sanitizeHtml } from "./sanitize";
import type {
  Address,
  Attachment,
  Label,
  ListThreadsParams,
  Message,
  ModifyThreadParams,
  Thread,
  ThreadPage,
  ThreadSummary,
} from "./types";

const PAGE_SIZE = 25;
const SYSTEM_LABELS = ["INBOX", "STARRED", "SENT", "DRAFT", "TRASH", "SPAM"];

function header(msg: gmail_v1.Schema$Message, name: string): string {
  const h = msg.payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

export function parseAddress(raw: string): Address {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: "", email: raw.trim() };
}

function parseAddressList(raw: string): Address[] {
  if (!raw) return [];
  return raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map(parseAddress)
    .filter((a) => a.email);
}

function decode(data?: string | null): string {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

function walkParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  out: { html: string[]; text: string[]; attachments: Attachment[] },
) {
  if (!part) return;
  const mime = part.mimeType ?? "";
  if (part.filename && part.body?.attachmentId) {
    out.attachments.push({
      id: part.body.attachmentId,
      filename: part.filename,
      mimeType: mime,
      size: part.body.size ?? 0,
    });
  } else if (mime === "text/html") {
    out.html.push(decode(part.body?.data));
  } else if (mime === "text/plain") {
    out.text.push(decode(part.body?.data));
  }
  part.parts?.forEach((p) => walkParts(p, out));
}

function toMessage(msg: gmail_v1.Schema$Message): Message {
  const out = { html: [] as string[], text: [] as string[], attachments: [] as Attachment[] };
  walkParts(msg.payload ?? undefined, out);
  const html = out.html.join("");
  return {
    id: msg.id!,
    from: parseAddress(header(msg, "From")),
    to: parseAddressList(header(msg, "To")),
    cc: parseAddressList(header(msg, "Cc")),
    date: Number(msg.internalDate ?? 0),
    subject: header(msg, "Subject"),
    html: html ? sanitizeHtml(html) : null,
    text: out.text.join("\n") || null,
    attachments: out.attachments,
    labelIds: msg.labelIds ?? [],
  };
}

export class GmailProvider implements MailProvider {
  private gmail: gmail_v1.Gmail;

  constructor(accessToken: string) {
    const client = new google.auth.OAuth2();
    client.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: "v1", auth: client });
  }

  async listLabels(): Promise<Label[]> {
    const { data } = await this.gmail.users.labels.list({ userId: "me" });
    const labels = data.labels ?? [];
    const detailed = await Promise.all(
      labels.map((l) =>
        this.gmail.users.labels.get({ userId: "me", id: l.id! }).then((r) => r.data),
      ),
    );
    return detailed.map((l) => ({
      id: l.id!,
      name: l.name!,
      system: l.type === "system",
      // Drafts count total; everything else counts unread threads.
      unread: (l.id === "DRAFT" ? l.threadsTotal : l.threadsUnread) ?? 0,
    }));
  }

  async listThreads({ labelId, query, pageToken }: ListThreadsParams): Promise<ThreadPage> {
    const { data } = await this.gmail.users.threads.list({
      userId: "me",
      maxResults: PAGE_SIZE,
      pageToken,
      q: query || undefined,
      labelIds: labelId && !query ? [labelId] : undefined,
    });
    const threads = await Promise.all(
      (data.threads ?? []).map((t) => this.summarize(t.id!)),
    );
    return { threads, nextPageToken: data.nextPageToken ?? null };
  }

  private async summarize(id: string): Promise<ThreadSummary> {
    const { data } = await this.gmail.users.threads.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });
    const msgs = data.messages ?? [];
    const first = msgs[0];
    const last = msgs[msgs.length - 1];
    const labelIds = [...new Set(msgs.flatMap((m) => m.labelIds ?? []))];
    return {
      id,
      subject: header(first, "Subject") || "(no subject)",
      snippet: last?.snippet ?? "",
      from: parseAddress(header(last, "From")),
      date: Number(last?.internalDate ?? 0),
      unread: labelIds.includes("UNREAD"),
      starred: labelIds.includes("STARRED"),
      labelIds,
      messageCount: msgs.length,
      extras: {},
    };
  }

  async getThread(id: string): Promise<Thread> {
    const { data } = await this.gmail.users.threads.get({ userId: "me", id, format: "full" });
    const messages = (data.messages ?? []).map(toMessage);
    return {
      id,
      subject: messages[0]?.subject || "(no subject)",
      messages,
      labelIds: [...new Set(messages.flatMap((m) => m.labelIds))],
    };
  }

  async modifyThread(id: string, { addLabelIds, removeLabelIds }: ModifyThreadParams) {
    await this.gmail.users.threads.modify({
      userId: "me",
      id,
      requestBody: { addLabelIds, removeLabelIds },
    });
  }

  async trashThread(id: string) {
    await this.gmail.users.threads.trash({ userId: "me", id });
  }
}

export { SYSTEM_LABELS };

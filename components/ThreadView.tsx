"use client";

import { useRouter } from "next/navigation";
import { useThread, useThreadAction } from "@/lib/hooks/useMail";
import { displayName, formatDate } from "./format";
import { MessageFrame } from "./MessageFrame";

export function ThreadView({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const { data: thread, isLoading, error } = useThread(id);
  const action = useThreadAction();

  if (isLoading) return <p className="p-6 text-sm text-zinc-500">Loading…</p>;
  if (error || !thread) return <p className="p-6 text-sm text-red-600">Couldn’t load this conversation.</p>;

  const unread = thread.labelIds.includes("UNREAD");
  const starred = thread.labelIds.includes("STARRED");
  const run = (body: object, leave = false) =>
    action.mutate({ id, body }, { onSuccess: () => leave && router.push(`/mail/${label}`) });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="mb-3 text-xl font-semibold">{thread.subject}</h1>
      <div className="mb-6 flex gap-2 text-sm">
        <button className="rounded border px-3 py-1" onClick={() => run({ action: "modify", removeLabelIds: ["INBOX"] }, true)}>Archive</button>
        <button className="rounded border px-3 py-1" onClick={() => run({ action: "trash" }, true)}>Trash</button>
        <button
          className="rounded border px-3 py-1"
          onClick={() => run({ action: "modify", ...(unread ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] }) })}
        >
          Mark {unread ? "read" : "unread"}
        </button>
        <button
          className="rounded border px-3 py-1"
          onClick={() => run({ action: "modify", ...(starred ? { removeLabelIds: ["STARRED"] } : { addLabelIds: ["STARRED"] }) })}
        >
          {starred ? "Unstar" : "Star"}
        </button>
      </div>
      <div className="flex flex-col gap-6">
        {thread.messages.map((m) => (
          <article key={m.id} className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
            <header className="mb-3 flex items-baseline justify-between text-sm">
              <div>
                <span className="font-medium">{displayName(m.from)}</span>{" "}
                <span className="text-zinc-500">&lt;{m.from.email}&gt;</span>
                <div className="text-xs text-zinc-500">to {m.to.map(displayName).join(", ")}</div>
              </div>
              <time className="text-xs text-zinc-500">{formatDate(m.date)}</time>
            </header>
            <MessageFrame message={m} />
            {!!m.attachments.length && (
              <ul className="mt-3 text-xs text-zinc-500">
                {m.attachments.map((a) => (
                  <li key={a.id}>📎 {a.filename} ({Math.ceil(a.size / 1024)} KB)</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

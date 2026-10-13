"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useLabels } from "@/lib/hooks/useMail";

const SYSTEM: { id: string; name: string }[] = [
  { id: "INBOX", name: "Inbox" },
  { id: "STARRED", name: "Starred" },
  { id: "SENT", name: "Sent" },
  { id: "DRAFT", name: "Drafts" },
  { id: "TRASH", name: "Trash" },
];

export function Sidebar() {
  const { label: current } = useParams<{ label?: string }>();
  const pathname = usePathname();
  const { data: labels } = useLabels();
  const unread = new Map(labels?.map((l) => [l.id, l.unread]));
  const custom = labels?.filter((l) => !l.system).sort((a, b) => a.name.localeCompare(b.name));

  const item = (id: string, name: string) => (
    <Link
      key={id}
      href={`/mail/${encodeURIComponent(id)}`}
      className={`flex items-center justify-between rounded px-3 py-1.5 text-sm ${
        decodeURIComponent(current ?? "") === id
          ? "bg-zinc-200 font-medium dark:bg-zinc-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
      }`}
    >
      <span className="truncate">{name}</span>
      {!!unread.get(id) && <span className="text-xs text-zinc-500">{unread.get(id)}</span>}
    </Link>
  );

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-zinc-200 p-2 dark:border-zinc-800">
      <Link
        href="/dashboard"
        className={`rounded px-3 py-1.5 text-sm ${
          pathname === "/dashboard" ? "bg-zinc-200 font-medium dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
        }`}
      >
        Dashboard
      </Link>
      {SYSTEM.map((s) => item(s.id, s.name))}
      <Link
        href="/activity"
        className={`rounded px-3 py-1.5 text-sm ${
          pathname === "/activity" ? "bg-zinc-200 font-medium dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
        }`}
      >
        Activity
      </Link>
      {!!custom?.length && (
        <div className="mt-3 px-3 pb-1 text-xs uppercase tracking-wide text-zinc-500">Labels</div>
      )}
      {custom?.map((l) => item(l.id, l.name))}
    </nav>
  );
}

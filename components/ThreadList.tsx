"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useThreads } from "@/lib/hooks/useMail";
import { displayName, formatDate } from "./format";

export function ThreadList({ label }: { label: string }) {
  const { threadId } = useParams<{ threadId?: string }>();
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useThreads(label);
  const threads = data?.pages.flatMap((p) => p.threads) ?? [];

  if (isLoading) return <p className="p-4 text-sm text-zinc-500">Loading…</p>;
  if (error) return <p className="p-4 text-sm text-red-600">Couldn’t load messages.</p>;
  if (!threads.length) return <p className="p-4 text-sm text-zinc-500">Nothing here.</p>;

  return (
    <ul className="flex w-96 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
      {threads.map((t) => (
        <li key={t.id}>
          <Link
            href={`/mail/${encodeURIComponent(label)}/${t.id}`}
            className={`block border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900 ${
              threadId === t.id ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-950"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`truncate text-sm ${t.unread ? "font-semibold" : ""}`}>
                {displayName(t.from)}
                {t.messageCount > 1 && (
                  <span className="ml-1 text-xs text-zinc-500">{t.messageCount}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">{formatDate(t.date)}</span>
            </div>
            <div className={`truncate text-sm ${t.unread ? "font-semibold" : ""}`}>{t.subject}</div>
            <div className="truncate text-xs text-zinc-500">{t.snippet}</div>
          </Link>
        </li>
      ))}
      {hasNextPage && (
        <li className="p-3">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full rounded border border-zinc-300 py-1.5 text-sm dark:border-zinc-700"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </li>
      )}
    </ul>
  );
}

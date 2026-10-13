"use client";

import Link from "next/link";
import { useActivity, useUndo } from "@/lib/hooks/useShipments";
import { formatDate } from "./format";

export function ActivityLog() {
  const { data, isLoading } = useActivity();
  const undo = useUndo();

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-semibold">Activity</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Everything the app did to your mail automatically. Undo puts an email back exactly as it was.
        </p>
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : data?.actions.length ? (
          <ul className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {data.actions.map((a) => (
              <li key={a.id} className="flex items-center gap-4 py-2.5">
                <span className={`min-w-0 flex-1 truncate ${a.undoneAt ? "text-zinc-400 line-through" : ""}`}>
                  {a.summary}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">{formatDate(a.createdAt)}</span>
                {a.undoneAt ? (
                  <span className="w-24 shrink-0 text-right text-xs text-zinc-400">Undone</span>
                ) : (
                  <span className="flex w-24 shrink-0 justify-end gap-3">
                    <Link
                      href={`/mail/${encodeURIComponent(data.labelId)}/${a.threadId}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                    <button onClick={() => undo.mutate(a.id)} className="text-blue-600 hover:underline">
                      Undo
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Nothing yet.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Label, Thread, ThreadPage } from "@/lib/mail/types";
import { api } from "./api";

export const keys = {
  labels: ["labels"] as const,
  threads: (label: string, q: string) => ["threads", label, q] as const,
  thread: (id: string) => ["thread", id] as const,
};

export function useLabels() {
  return useQuery({ queryKey: keys.labels, queryFn: () => api<Label[]>("/api/mail/labels") });
}

export function useThreads(label: string, q = "") {
  return useInfiniteQuery({
    queryKey: keys.threads(label, q),
    initialPageParam: "",
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ label });
      if (q) p.set("q", q);
      if (pageParam) p.set("pageToken", pageParam);
      return api<ThreadPage>(`/api/mail/threads?${p}`);
    },
    getNextPageParam: (last) => last.nextPageToken ?? undefined,
  });
}

export function useThread(id: string) {
  return useQuery({
    queryKey: keys.thread(id),
    queryFn: () => api<Thread>(`/api/mail/threads/${id}`),
  });
}

export function useThreadAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api(`/api/mail/threads/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: keys.labels });
    },
  });
}

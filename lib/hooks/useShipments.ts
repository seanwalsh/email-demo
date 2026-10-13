"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface ShipmentDto {
  id: number;
  sender: string;
  carrier: string;
  trackingNumber: string;
  trackUrl: string;
  status: "shipped" | "out_for_delivery" | "delivered";
  eta: string | null;
  threadId: string;
  updatedAt: number;
}

export interface ActivityDto {
  id: number;
  summary: string;
  threadId: string;
  createdAt: number;
  undoneAt: number | null;
}

const POLL_MS = 60_000;

// Scans for new shipment email on mount and every minute while the app is open.
export function useAutoSync() {
  const qc = useQueryClient();
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await api<{ moved: number; matched: number }>("/api/automations/sync", { method: "POST" });
        if (stop) return;
        qc.invalidateQueries({ queryKey: ["shipments"] });
        if (r.moved || r.matched) {
          qc.invalidateQueries({ queryKey: ["activity"] });
          qc.invalidateQueries({ queryKey: ["labels"] });
          qc.invalidateQueries({ queryKey: ["threads"] });
        }
      } catch {
        /* next tick retries */
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [qc]);
}

export function useShipments() {
  return useQuery({
    queryKey: ["shipments"],
    queryFn: () => api<{ labelId: string; shipments: ShipmentDto[] }>("/api/shipments"),
  });
}

export function useActivity() {
  return useQuery({ queryKey: ["activity"], queryFn: () => api<{ labelId: string; actions: ActivityDto[] }>("/api/activity") });
}

export function useUndo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/activity/${id}/undo`, { method: "POST" }),
    onSettled: () => qc.invalidateQueries(),
  });
}

export function useDismiss() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/shipments/${id}/dismiss`, { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["shipments"] }),
  });
}

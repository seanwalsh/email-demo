"use client";

import Link from "next/link";
import type { ShipmentDto } from "@/lib/hooks/useShipments";
import { useDismiss } from "@/lib/hooks/useShipments";
import { CopyButton } from "./CopyButton";

const STATUS: Record<ShipmentDto["status"], string> = {
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

// "2026-10-14" -> "Wed 10/14"
function formatEta(eta: string): string {
  const d = new Date(`${eta}T12:00:00Z`);
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${day} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function ShipmentCard({ s, labelId }: { s: ShipmentDto; labelId: string }) {
  const dismiss = useDismiss();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          s.status === "out_for_delivery"
            ? "bg-amber-100 text-amber-900"
            : s.status === "delivered"
              ? "bg-green-100 text-green-900"
              : "bg-zinc-100 text-zinc-700"
        }`}
      >
        {STATUS[s.status]}
      </span>
      <span>
        Shipment from <strong>{s.sender}</strong> via {s.carrier}{" "}
        <span className="font-mono">{s.trackingNumber}</span>
      </span>
      <CopyButton value={s.trackingNumber} label="Copy tracking number" />
      <span className="text-zinc-500">· ETA {s.eta ? formatEta(s.eta) : "unknown"}</span>
      <span className="ml-auto flex items-center gap-3">
        <a href={s.trackUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Track
        </a>
        <Link href={`/mail/${encodeURIComponent(labelId)}/${s.threadId}`} className="text-blue-600 hover:underline">
          Open email
        </Link>
        <button onClick={() => dismiss.mutate(s.id)} className="text-zinc-400 hover:text-zinc-700" aria-label="Dismiss">
          ✕
        </button>
      </span>
    </li>
  );
}

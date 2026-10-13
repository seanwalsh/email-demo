"use client";

import Link from "next/link";
import type { ShipmentDto } from "@/lib/hooks/useShipments";
import { useDismiss } from "@/lib/hooks/useShipments";
import { CopyButton } from "./CopyButton";

const STEPS: { key: ShipmentDto["status"]; label: string }[] = [
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

// "2026-10-14" -> "Wed 10/14"
function shortDate(eta: string): string {
  const d = new Date(`${eta}T12:00:00Z`);
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${day} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function headline(s: ShipmentDto): { text: string; muted?: boolean } {
  if (s.status === "delivered") return { text: "Delivered" };
  if (s.status === "out_for_delivery") return { text: "Arriving today" };
  if (!s.eta) return { text: "Arrival date unknown", muted: true };

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = s.eta.split("-").map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - today) / 864e5);
  if (days === 0) return { text: "Arriving today" };
  if (days === 1) return { text: "Arriving tomorrow" };
  if (days < 0) return { text: `Expected ${shortDate(s.eta)}` };
  return { text: `Arriving ${shortDate(s.eta)}` };
}

// Stable soft tint per sender so cards are scannable without logos.
function tint(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { backgroundColor: `hsl(${h} 70% 92%)`, color: `hsl(${h} 45% 32%)` };
}

const ICON = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ghost =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

export function ShipmentCard({ s, labelId }: { s: ShipmentDto; labelId: string }) {
  const dismiss = useDismiss();
  const step = STEPS.findIndex((x) => x.key === s.status);
  const { text, muted } = headline(s);
  const done = s.status === "delivered";

  return (
    <li
      className={`group relative rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 ${
        done ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          style={tint(s.sender)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          aria-hidden
        >
          {s.sender.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.sender}</span>
          <span className="text-zinc-500"> · {s.carrier}</span>
        </div>
        <Link href={`/mail/${encodeURIComponent(labelId)}/${s.threadId}`} className={`${ghost} -mr-2`} title="Open email" aria-label="Open email">
          <svg {...ICON} aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
          Email
        </Link>
        <button
          onClick={() => dismiss.mutate(s.id)}
          aria-label="Dismiss"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 opacity-0 shadow-sm transition hover:text-zinc-700 focus-visible:opacity-100 group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div
          className={`shrink-0 text-sm font-semibold tracking-tight ${
            muted ? "text-zinc-400" : "text-zinc-900 dark:text-zinc-50"
          }`}
        >
          {text}
        </div>
        <div className="flex flex-1 gap-1" role="img" aria-label={`Status: ${STEPS[step].label}`} title={STEPS[step].label}>
          {STEPS.map((x, i) => (
            <span
              key={x.key}
              className={`h-1 flex-1 rounded-full ${
                i <= step ? (done ? "bg-green-500" : "bg-zinc-900 dark:bg-zinc-100") : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 rounded-md bg-zinc-50 py-0.5 pl-2.5 pr-0.5 dark:bg-zinc-800/60">
        <span className="whitespace-nowrap font-mono text-xs text-zinc-600 dark:text-zinc-300">{s.trackingNumber}</span>
        <CopyButton value={s.trackingNumber} label="Copy tracking number" />
        <a href={s.trackUrl} target="_blank" rel="noopener noreferrer" className={`${ghost} ml-auto`}>
          <svg {...ICON}><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
          Track
        </a>
      </div>
    </li>
  );
}

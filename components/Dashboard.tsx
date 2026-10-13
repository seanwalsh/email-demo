"use client";

import Link from "next/link";
import { useAutoSync, useShipments } from "@/lib/hooks/useShipments";
import { ShipmentCard } from "./ShipmentCard";

export function Dashboard() {
  useAutoSync();
  const { data, isLoading } = useShipments();

  const active = data?.shipments.filter((s) => s.status !== "delivered") ?? [];
  const delivered = data?.shipments.filter((s) => s.status === "delivered") ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-semibold">Inbound packages</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Pulled from your email automatically. Shipping emails are marked read and moved to Shipments.
        </p>

        {isLoading ? (
          <p className="text-sm text-zinc-500">Checking your mail…</p>
        ) : active.length ? (
          <ul className="flex flex-col gap-2">
            {active.map((s) => (
              <ShipmentCard key={s.id} s={s} labelId={data!.labelId} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No packages on the way.</p>
        )}

        {!!delivered.length && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-zinc-500">Delivered ({delivered.length})</summary>
            <ul className="mt-2 flex flex-col gap-2">
              {delivered.map((s) => (
                <ShipmentCard key={s.id} s={s} labelId={data!.labelId} />
              ))}
            </ul>
          </details>
        )}

        <p className="mt-10 text-sm">
          <Link href="/mail/INBOX" className="text-blue-600 hover:underline">
            Go to inbox →
          </Link>
        </p>
      </div>
    </div>
  );
}

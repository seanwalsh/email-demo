"use client";

import { useAutoSync, useShipments } from "@/lib/hooks/useShipments";
import { ShipmentCard } from "./ShipmentCard";

export function Dashboard() {
  useAutoSync();
  const { data, isLoading } = useShipments();

  const active = data?.shipments.filter((s) => s.status !== "delivered") ?? [];
  const delivered = data?.shipments.filter((s) => s.status === "delivered") ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

      <aside className="w-full shrink-0 border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-black lg:w-[26rem] lg:overflow-y-auto lg:border-l">
        <h2 className="mb-3 text-sm font-semibold">Inbound packages</h2>

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
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-zinc-500">Delivered ({delivered.length})</summary>
            <ul className="mt-2 flex flex-col gap-2">
              {delivered.map((s) => (
                <ShipmentCard key={s.id} s={s} labelId={data!.labelId} />
              ))}
            </ul>
          </details>
        )}
      </aside>
    </div>
  );
}

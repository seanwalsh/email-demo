import { Suspense } from "react";
import { ThreadList } from "@/components/ThreadList";

async function ListPane({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  return (
    <Suspense fallback={null}>
      <ThreadList label={decodeURIComponent(label)} />
    </Suspense>
  );
}

export default function LabelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ label: string }>;
}) {
  return (
    <>
      <Suspense fallback={<div className="w-96 shrink-0 border-r border-zinc-200 dark:border-zinc-800" />}>
        <ListPane params={params} />
      </Suspense>
      {children}
    </>
  );
}

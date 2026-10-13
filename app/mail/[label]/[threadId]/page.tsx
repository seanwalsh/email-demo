import { Suspense } from "react";
import { ThreadView } from "@/components/ThreadView";

async function Thread({ params }: { params: Promise<{ label: string; threadId: string }> }) {
  const { label, threadId } = await params;
  return (
    <Suspense fallback={null}>
      <ThreadView id={threadId} label={decodeURIComponent(label)} />
    </Suspense>
  );
}

export default function ThreadPage({
  params,
}: {
  params: Promise<{ label: string; threadId: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Thread params={params} />
    </Suspense>
  );
}

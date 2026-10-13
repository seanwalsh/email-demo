import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Suspense fallback={<div className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800" />}>
        <Sidebar />
      </Suspense>
      {children}
    </div>
  );
}

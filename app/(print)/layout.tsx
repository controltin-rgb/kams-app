import type { ReactNode } from "react";

/** Print documents: plain white A4 pages, no app shell. Each page checks its own permissions. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-neutral-200 py-8 text-black print:bg-white print:py-0">{children}</div>;
}

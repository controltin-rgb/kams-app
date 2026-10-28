import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { GradientIcon } from "@/components/gradient-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getPublicAsset } from "@/modules/assets/queries";
import { PublicReportForm } from "./public-report-form";

export const metadata: Metadata = { title: "แจ้งซ่อม | AMS", robots: { index: false } };

async function Content({ params }: { params: PageProps<"/a/[code]/report">["params"] }) {
  const code = decodeURIComponent((await params).code);
  const [session, settings, asset] = await Promise.all([getSession(), getSettings(), getPublicAsset(code)]);
  const newTicketPath = `/tickets/new?asset=${encodeURIComponent(code)}`;

  // Signed-in users get the full form (with attachments)
  if (session) redirect(newTicketPath);
  if (!asset) return <p className="text-center text-muted-foreground">ไม่พบครุภัณฑ์ {code}</p>;

  if (!settings["ticket.allowAnonymousQr"]) {
    return (
      <div className="space-y-4 text-center">
        <p>กรุณาเข้าสู่ระบบก่อนแจ้งซ่อม</p>
        <Button asChild variant="gradient" className="h-12 w-full rounded-xl">
          <Link href={`/auth?next=${encodeURIComponent(newTicketPath)}`}>เข้าสู่ระบบ</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-3 text-sm">
        <span className="font-mono font-semibold">{asset.assetCode}</span> · {asset.name}
      </div>
      <PublicReportForm assetCode={asset.assetCode} />
      <p className="text-center text-xs text-muted-foreground">
        มีบัญชีผู้ใช้?{" "}
        <Link href={`/auth?next=${encodeURIComponent(newTicketPath)}`} className="text-primary hover:underline">
          เข้าสู่ระบบ
        </Link>{" "}
        เพื่อแนบรูปและติดตามสถานะ
      </p>
    </div>
  );
}

export default function PublicReportPage({ params }: PageProps<"/a/[code]/report">) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-auth p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="relative w-full max-w-lg animate-fade-up rounded-[32px] bg-card p-6 shadow-2xl shadow-black/10 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <GradientIcon icon={Wrench} tone="pink" className="size-11 rounded-xl" />
          <h1 className="text-xl font-semibold">แจ้งซ่อม</h1>
        </div>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </main>
  );
}

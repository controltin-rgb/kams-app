import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Blocks, LogIn, PackageSearch, Wrench } from "lucide-react";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { GradientIcon } from "@/components/gradient-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getPublicAsset } from "@/modules/assets/queries";

export const metadata: Metadata = { title: "ข้อมูลครุภัณฑ์ | AMS", robots: { index: false } };

// Public page opened from QR labels: shows only non-sensitive info (CLAUDE.md §8).
async function AssetCard({ params }: { params: PageProps<"/a/[code]">["params"] }) {
  const { code } = await params;
  const [asset, session] = await Promise.all([getPublicAsset(decodeURIComponent(code)), getSession()]);

  if (!asset) {
    return (
      <div className="text-center">
        <GradientIcon icon={PackageSearch} tone="red" className="mx-auto size-16 animate-pop rounded-2xl" iconClass="size-8" />
        <h1 className="mt-5 text-xl font-semibold">ไม่พบครุภัณฑ์</h1>
        <p className="mt-1 text-muted-foreground">รหัส {decodeURIComponent(code)} ไม่มีในระบบ</p>
      </div>
    );
  }

  const canView = session && can(session.user.role, "asset", "view");
  const newTicketPath = `/tickets/new?asset=${encodeURIComponent(asset.assetCode)}`;
  // Logged in → normal form; otherwise anonymous form if allowed, else sign in first and come back
  const reportHref = session
    ? newTicketPath
    : (await getSettings())["ticket.allowAnonymousQr"]
      ? `/a/${encodeURIComponent(asset.assetCode)}/report`
      : `/auth?next=${encodeURIComponent(newTicketPath)}`;
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="font-mono text-2xl font-bold tracking-wide">{asset.assetCode}</p>
        <h1 className="mt-1 text-lg font-semibold">{asset.name}</h1>
        <div className="mt-3 flex justify-center">
          <AssetStatusBadge status={asset.status} />
        </div>
      </div>
      <dl className="divide-y divide-border rounded-2xl border border-border">
        {(
          [
            ["ประเภท", asset.category.name],
            ["ยี่ห้อ", asset.brand],
            ["รุ่น", asset.model],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value || "-"}</dd>
          </div>
        ))}
      </dl>
      {(!session || can(session.user.role, "ticket", "create")) && (
        <Button asChild variant="gradient" className="h-12 w-full rounded-xl bg-linear-to-r from-[#f0457f] to-[#ff7aa8] shadow-pink-500/25">
          <Link href={reportHref}>
            <Wrench /> แจ้งซ่อม / แจ้งปัญหา
          </Link>
        </Button>
      )}
      {canView ? (
        <Button asChild variant="outline" className="h-12 w-full rounded-xl">
          <Link href={`/assets/${asset.id}`}>ดูรายละเอียดและประวัติ</Link>
        </Button>
      ) : (
        <div className="space-y-2 text-center">
          <Button asChild variant="outline" className="h-12 w-full rounded-xl">
            <Link href="/auth">
              <LogIn /> เข้าสู่ระบบเพื่อดูข้อมูลเพิ่มเติม
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">ผู้ถือครอง สถานที่ และประวัติ แสดงเฉพาะผู้ที่มีสิทธิ์</p>
        </div>
      )}
    </div>
  );
}

export default function PublicAssetPage({ params }: PageProps<"/a/[code]">) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-auth p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md animate-fade-up rounded-[32px] bg-card p-6 shadow-2xl shadow-black/10 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <GradientIcon icon={Blocks} tone="orange" className="size-11 rounded-xl" />
          <span className="font-semibold">Assets Management System</span>
        </div>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <AssetCard params={params} />
        </Suspense>
      </div>
    </main>
  );
}

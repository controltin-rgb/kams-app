import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { CampaignStatusBadge } from "@/components/audit-badges";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { getCampaign } from "@/modules/audits/queries";
import { canScanCampaign } from "@/modules/audits/service";
import { CampaignActions } from "./campaign-actions";
import { RecordsTable } from "./records-table";

export const metadata: Metadata = { title: "รอบตรวจนับ | AMS" };

function Stat({ label, value, tone = "" }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm shadow-black/4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

export default async function CampaignPage({ params }: PageProps<"/audits/[id]">) {
  const session = await requirePermission("audit", "view");
  const { id } = await params;
  const user = { id: session.user.id, role: session.user.role };
  const c = await getCampaign(id, user);
  if (!c) notFound();
  const canScan = await canScanCampaign(user, id);

  const count = (r: string) => c.records.filter((x) => x.result === r).length;
  const found = c.records.filter((r) => r.assetId && r.result !== "MISSING").length;
  const pending = c.records.filter((r) => r.needsDecision && !r.reconciled).length;
  const progress = c.expectedCount ? Math.min(100, Math.round((found / c.expectedCount) * 100)) : 0;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={ClipboardCheck}
        tone="violet"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.title} <CampaignStatusBadge status={c.status} />
          </span>
        }
        description={`${formatDate(c.startDate)} – ${formatDate(c.endDate)} · ${c.scopeNames.join(", ")}`}
        actions={
          <CampaignActions
            id={c.id}
            status={c.status}
            pending={pending}
            canScan={canScan}
            canManage={c.canManage}
            canApprove={c.canApprove}
            canDelete={can(user.role, "audit", "delete")}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="ครุภัณฑ์ในขอบเขต" value={c.expectedCount} />
        <Stat label={`สแกนพบ (${progress}%)`} value={found} tone="text-primary" />
        <Stat label="ตรงตามทะเบียน" value={count("MATCHED")} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="พบต่างสถานที่" value={count("RELOCATED")} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="ไม่พบ" value={c.status === "IN_PROGRESS" || c.status === "DRAFT" ? "-" : count("MISSING")} tone="text-red-600 dark:text-red-400" />
        <Stat label="ไม่มีในทะเบียน" value={count("UNREGISTERED")} tone="text-violet-600 dark:text-violet-400" />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้า">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>ผู้ตรวจนับ: {c.auditors.map((a) => a.name).join(", ") || "-"}</span>
          {c.completedAt && <span>ปิดการสแกน: {formatDateTime(c.completedAt)}</span>}
          {c.closedAt && <span>ปิดรอบ: {formatDateTime(c.closedAt)}</span>}
          {c.status === "COMPLETED" && <span className="font-medium text-amber-600 dark:text-amber-400">รอตัดสินใจ {pending} รายการ</span>}
        </div>
        {c.note && <p className="mb-4 whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm">{c.note}</p>}
        <RecordsTable campaignId={c.id} rows={c.records} reconcilable={c.status === "COMPLETED" && c.canApprove} />
      </Panel>
    </div>
  );
}

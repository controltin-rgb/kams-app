import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Printer, Settings2, Store, Wrench } from "lucide-react";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ClaimStatusBadge } from "@/components/pm-badges";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { assetStatusLabels } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { getClaim } from "@/modules/claims/queries";
import { ClaimActions } from "./claim-actions";

export const metadata: Metadata = { title: "รายการเคลม | AMS" };

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });

function Card({ icon: Icon, title, children }: { icon: typeof Wrench; title: string; children: ReactNode }) {
  return (
    <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Rows({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="space-y-2.5 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium">{value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  const session = await requirePermission("claim", "view");
  const { id } = await params;
  const c = await getClaim(id);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={Wrench}
        tone="blue"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{c.claimNumber}</span> <ClaimStatusBadge status={c.status} />
          </span>
        }
        description={`${c.asset.assetCode} ${c.asset.name} → ${c.vendor.name}`}
        actions={
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href={`/print/claims/${c.id}`} target="_blank">
              <Printer /> ใบส่งเคลม
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card icon={ClipboardList} title="รายละเอียด">
            <p className="whitespace-pre-line">{c.problem}</p>
            {c.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm">{c.notes}</p>}
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <Rows
                items={[
                  [
                    "ครุภัณฑ์",
                    <Link key="a" href={`/assets/${c.asset.id}`} className="font-mono text-primary hover:underline">
                      {c.asset.assetCode}
                    </Link>,
                  ],
                  ["Serial ปัจจุบัน", c.asset.serialNumber],
                  ["สถานะครุภัณฑ์", <AssetStatusBadge key="s" status={c.asset.status} />],
                  ["สถานะก่อนเคลม", assetStatusLabels[c.previousAssetStatus]],
                ]}
              />
              <Rows
                items={[
                  ["วันที่ส่ง", formatDate(c.sentDate)],
                  ["คาดว่าได้คืน", formatDate(c.expectedReturnDate)],
                  ["รับคืนจริง", formatDate(c.actualReturnDate)],
                  ["ค่าใช้จ่าย", c.cost ? money.format(Number(c.cost)) : null],
                  ...(c.status === "REPLACED" ? ([["Serial เดิม → ใหม่", `${c.oldSerial ?? "-"} → ${c.newSerial}`]] as [string, ReactNode][]) : []),
                ]}
              />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          {can(session.user.role, "claim", "update") && (
            <Card icon={Settings2} title="ดำเนินการ">
              <ClaimActions claimId={c.id} status={c.status} currentSerial={c.asset.serialNumber} />
            </Card>
          )}
          <Card icon={Store} title="ผู้ขาย / ศูนย์บริการ">
            <Rows
              items={[
                ["ชื่อ", c.vendor.name],
                ["ผู้ติดต่อ", c.vendor.contact],
                ["โทรศัพท์", c.vendor.phone],
                ["อีเมล", c.vendor.email],
              ]}
            />
          </Card>
          <Card icon={ClipboardList} title="อ้างอิง">
            <Rows
              items={[
                [
                  "งานแจ้งซ่อม",
                  c.ticket && (
                    <Link key="t" href={`/tickets/${c.ticket.id}`} className="text-primary hover:underline">
                      {c.ticket.ticketNumber}
                    </Link>
                  ),
                ],
                ["ผู้บันทึก", c.createdByName],
                ["บันทึกเมื่อ", formatDateTime(c.createdAt)],
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

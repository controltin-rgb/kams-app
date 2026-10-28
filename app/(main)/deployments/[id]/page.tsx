import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, FileSignature, ListChecks, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { assetStatusLabels, transferItemActionLabels, transferTypeLabels } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import { formatDateTime } from "@/lib/utils/date";
import { getTransfer } from "@/modules/deployments/queries";
import { SignForm } from "./sign-form";

export const metadata: Metadata = { title: "เอกสารส่งมอบ | AMS" };

function Card({ icon: Icon, title, children, delay = 0 }: { icon: typeof ListChecks; title: string; children: ReactNode; delay?: number }) {
  return (
    <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6" style={{ animationDelay: `${delay}ms` }}>
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

const arrow = (from: string | null, to: string | null) => (from === to ? (to ?? "-") : `${from ?? "-"} → ${to ?? "-"}`);

export default async function TransferDetailPage({ params }: PageProps<"/deployments/[id]">) {
  await requirePermission("deployment", "view");
  const { id } = await params;
  const t = await getTransfer(id);
  if (!t) notFound();

  const info: [string, ReactNode][] = [
    ["ประเภท", transferTypeLabels[t.type]],
    ["วันที่", formatDateTime(t.createdAt)],
    ["ผู้ทำรายการ", t.performedByName],
    ["ผู้รับ", t.toOwnerName],
    ["สถานที่", t.toLocationPath],
    ["แผนก", t.toDepartmentName],
    [
      "งานแจ้งซ่อม",
      t.ticket && (
        <Link href={`/tickets/${t.ticket.id}`} className="text-primary hover:underline">
          {t.ticket.ticketNumber}
        </Link>
      ),
    ],
    ["เหตุผล", t.reason],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={ArrowLeftRight}
        tone="green"
        title={<span className="font-mono">{t.docNumber}</span>}
        description={transferTypeLabels[t.type]}
        actions={
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href={`/print/transfers/${t.id}`} target="_blank">
              <Printer /> พิมพ์เอกสาร
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card icon={ListChecks} title={`รายการ (${t.items.length})`} delay={60}>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-160 text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-semibold">
                    <th>ครุภัณฑ์</th>
                    <th>รายการ</th>
                    <th>ผู้ถือครอง</th>
                    <th>สถานที่</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {t.items.map((i) => (
                    <tr key={i.id} className="[&>td]:px-3 [&>td]:py-2.5 align-top">
                      <td>
                        <Link href={`/assets/${i.asset.id}`} className="font-mono font-semibold text-primary hover:underline">
                          {i.asset.assetCode}
                        </Link>
                        <div className="text-xs text-muted-foreground">{i.asset.name}</div>
                      </td>
                      <td>{transferItemActionLabels[i.action]}</td>
                      <td>{arrow(i.fromOwner, i.toOwner)}</td>
                      <td className="max-w-56">{arrow(i.fromLocation, i.toLocation)}</td>
                      <td>{arrow(i.fromStatus && assetStatusLabels[i.fromStatus], i.toStatus && assetStatusLabels[i.toStatus])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card icon={ListChecks} title="ข้อมูลเอกสาร" delay={90}>
            <dl className="space-y-2.5 text-sm">
              {info.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value || "-"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card icon={FileSignature} title="ลายเซ็นผู้รับ" delay={140}>
            {t.signedAt && t.signatureId ? (
              <div className="space-y-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by the authorised file route */}
                <img src={`/api/files/${t.signatureId}`} alt={`ลายเซ็น ${t.signedByName ?? ""}`} className="mx-auto max-h-32 rounded-xl bg-white p-2" />
                <p className="font-semibold">{t.signedByName}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(t.signedAt)}</p>
              </div>
            ) : (
              <SignForm transferId={t.id} defaultName={t.toOwnerName} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

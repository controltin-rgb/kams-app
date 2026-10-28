"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { AuditResultBadge } from "@/components/audit-badges";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { Button } from "@/components/ui/button";
import type { AuditDecision } from "@/generated/prisma/enums";
import { assetConditionLabels, auditDecisionLabels, auditResultLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils/date";
import { reconcileRecords } from "@/modules/audits/actions";
import type { AuditRecordRow } from "@/modules/audits/queries";

const col = dataTableColumns<AuditRecordRow>();

function decisionText(r: AuditRecordRow) {
  if (r.decision) return auditDecisionLabels[r.decision];
  return r.needsDecision ? "รอตัดสินใจ" : "-";
}

function DecisionButtons({ campaignId, recordId }: { campaignId: string; recordId: string }) {
  const [pending, start] = useTransition();
  const run = (decision: AuditDecision) =>
    start(async () => {
      const r = await reconcileRecords(campaignId, [recordId], decision);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={pending} onClick={() => run("APPLY")} aria-label="อนุมัติ">
        <Check /> อนุมัติ
      </Button>
      <Button size="sm" variant="ghost" className="h-8 rounded-lg" disabled={pending} onClick={() => run("IGNORE")} aria-label="ข้าม">
        <X /> ข้าม
      </Button>
    </div>
  );
}

const filters: DataTableFilter[] = [{ columnId: "result", label: "ผลตรวจนับ", options: Object.entries(auditResultLabels).map(([value, label]) => ({ value, label })) }];

export function RecordsTable({ campaignId, rows, reconcilable }: { campaignId: string; rows: AuditRecordRow[]; reconcilable: boolean }) {
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("scannedCode", {
          header: "รหัส",
          cell: ({ row }) =>
            row.original.assetId ? (
              <Link href={`/assets/${row.original.assetId}`} className="font-mono text-sm font-semibold text-primary hover:underline">
                {row.original.scannedCode}
              </Link>
            ) : (
              <span className="font-mono text-sm">{row.original.scannedCode}</span>
            ),
        }),
        col.accessor("assetName", { header: "ชื่อครุภัณฑ์", cell: ({ getValue }) => <span className="line-clamp-1 max-w-60">{getValue() || "-"}</span> }),
        col.accessor("result", {
          header: "ผล",
          filterFn: "equalsString",
          cell: ({ row }) => <AuditResultBadge result={row.original.result} />,
          meta: { export: (r) => auditResultLabels[r.result] },
        }),
        col.accessor("condition", {
          header: "สภาพ",
          cell: ({ row }) => {
            const r = row.original;
            const changed = r.result !== "MISSING" && r.assetCondition && r.assetCondition !== r.condition;
            return changed ? (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {assetConditionLabels[r.assetCondition!]} → {assetConditionLabels[r.condition]}
              </span>
            ) : (
              assetConditionLabels[r.condition]
            );
          },
          meta: { export: (r) => assetConditionLabels[r.condition] },
        }),
        col.accessor("expectedLocation", { header: "ตามทะเบียน", cell: ({ getValue }) => getValue() || "-" }),
        col.accessor("actualLocation", { header: "พบที่", cell: ({ getValue }) => getValue() || "-" }),
        col.accessor("scannedBy", { header: "ผู้สแกน", cell: ({ getValue }) => getValue() || "-" }),
        col.accessor("scannedAt", { header: "เวลา", cell: ({ getValue }) => formatDateTime(getValue()), meta: { export: (r) => formatDateTime(r.scannedAt, "") } }),
        col.accessor("notes", { header: "หมายเหตุ", cell: ({ getValue }) => <span className="line-clamp-2 max-w-48 text-sm">{getValue() || "-"}</span> }),
        col.display({
          id: "decision",
          header: "การตัดสินใจ",
          cell: ({ row }) => {
            const r = row.original;
            if (reconcilable && r.needsDecision && !r.reconciled) return <DecisionButtons campaignId={campaignId} recordId={r.id} />;
            return <span className={r.decision === "APPLY" ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>{decisionText(r)}</span>;
          },
          meta: { label: "การตัดสินใจ", export: decisionText },
        }),
      ]),
    [campaignId, reconcilable],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      pageSizes={[25, 50, 100, 500]}
      exportName="stock-take-results"
      printTitle="ผลการตรวจนับครุภัณฑ์"
      searchPlaceholder="ค้นหารหัส, ชื่อ, สถานที่..."
      emptyMessage="ยังไม่มีผลการสแกน"
    />
  );
}

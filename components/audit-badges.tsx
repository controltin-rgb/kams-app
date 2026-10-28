import type { AuditResult, CampaignStatus } from "@/generated/prisma/enums";
import { auditResultLabels, auditResultTone, campaignStatusLabels, campaignStatusTone } from "@/lib/labels";

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold";

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <span className={`${base} ${campaignStatusTone[status]}`}>{campaignStatusLabels[status]}</span>;
}

export function AuditResultBadge({ result }: { result: AuditResult }) {
  return <span className={`${base} ${auditResultTone[result]}`}>{auditResultLabels[result]}</span>;
}

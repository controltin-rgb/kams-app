import type { ClaimStatus, PmRunStatus } from "@/generated/prisma/enums";
import { claimStatusLabels, claimStatusTone, pmRunStatusLabels, pmRunStatusTone } from "@/lib/labels";

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold";

export function PmRunStatusBadge({ status }: { status: PmRunStatus }) {
  return <span className={`${base} ${pmRunStatusTone[status]}`}>{pmRunStatusLabels[status]}</span>;
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={`${base} ${claimStatusTone[status]}`}>{claimStatusLabels[status]}</span>;
}

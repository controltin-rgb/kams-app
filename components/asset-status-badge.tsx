import type { AssetStatus } from "@/generated/prisma/enums";
import { assetStatusLabels, assetStatusTone } from "@/lib/labels";

export function AssetStatusBadge({ status, className = "" }: { status: AssetStatus; className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${assetStatusTone[status]} ${className}`}>
      {assetStatusLabels[status]}
    </span>
  );
}

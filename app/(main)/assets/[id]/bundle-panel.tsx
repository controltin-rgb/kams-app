"use client";

import Link from "next/link";
import { Plus, Unlink } from "lucide-react";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { SelectField } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import type { AssetStatus, RelationType } from "@/generated/prisma/enums";
import { assetStatusLabels, relationTypeLabels, returnStatuses } from "@/lib/labels";
import { attachChild, detachChild } from "@/modules/deployments/actions";

type Option = { value: string; label: string };
type Child = { relationshipId: string; type: RelationType; id: string; assetCode: string; name: string; status: AssetStatus };

export function BundlePanel({
  assetId,
  parent,
  items,
  candidates,
  locations,
  canEdit,
}: {
  assetId: string;
  parent: { id: string; assetCode: string; name: string; type: RelationType } | null;
  items: Child[];
  candidates: Option[];
  locations: Option[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      {parent && (
        <p className="rounded-2xl border border-border bg-muted/30 p-3 text-sm">
          เป็น{relationTypeLabels[parent.type]}ของชุด{" "}
          <Link href={`/assets/${parent.id}`} className="font-mono font-semibold text-primary hover:underline">
            {parent.assetCode}
          </Link>{" "}
          {parent.name}
          <span className="mt-1 block text-xs text-muted-foreground">ผู้ถือครอง/สถานที่เปลี่ยนตามชุดหลักอัตโนมัติ</span>
        </p>
      )}

      {items.length > 0 ? (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {items.map((c) => (
            <li key={c.relationshipId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/assets/${c.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
                  {c.assetCode}
                </Link>{" "}
                <span className="text-sm">{c.name}</span>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {relationTypeLabels[c.type]} <AssetStatusBadge status={c.status} />
                </div>
              </div>
              {canEdit && (
                <FormDialog
                  title={`ถอด ${c.assetCode} ออกจากชุด`}
                  description="ชิ้นที่ถอดจะไม่มีผู้ถือครอง และเปลี่ยนสถานะตามที่เลือก"
                  action={detachChild}
                  hidden={{ relationshipId: c.relationshipId }}
                  submitLabel="ถอดออก"
                  trigger={
                    <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground hover:text-destructive">
                      <Unlink /> ถอด
                    </Button>
                  }
                >
                  {() => (
                    <>
                      <SelectField label="สถานะหลังถอด" name="status" options={returnStatuses.map((s) => ({ value: s, label: assetStatusLabels[s] }))} defaultValue="SPARE" required />
                      <SelectField label="เก็บไว้ที่" name="locationId" options={locations} allowEmpty emptyLabel="- ที่เดิม -" />
                    </>
                  )}
                </FormDialog>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !parent && <p className="text-sm text-muted-foreground">ยังไม่มีชิ้นส่วนหรืออุปกรณ์เสริมในชุดนี้</p>
      )}

      {canEdit && !parent && (
        <FormDialog
          title="ติดตั้งชิ้นส่วน / อุปกรณ์เสริม"
          description="ชิ้นที่ติดตั้งจะได้รับผู้ถือครอง สถานที่ และแผนกเดียวกับชุดนี้"
          action={attachChild}
          hidden={{ parentId: assetId }}
          submitLabel="ติดตั้ง"
          trigger={
            <Button variant="outline" className="h-10 rounded-xl">
              <Plus /> ติดตั้งเข้าชุด
            </Button>
          }
        >
          {(state) => (
            <>
              <SelectField label="ครุภัณฑ์" name="childId" options={candidates} required errors={state.fieldErrors?.childId} />
              <SelectField
                label="ความสัมพันธ์"
                name="type"
                options={Object.entries(relationTypeLabels).map(([value, label]) => ({ value, label }))}
                defaultValue="COMPONENT"
                required
              />
            </>
          )}
        </FormDialog>
      )}
    </div>
  );
}

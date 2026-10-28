import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Boxes, Headset, History, MapPin, Package, PackageCheck, Printer, QrCode, Repeat, Store, SlidersHorizontal, Wrench } from "lucide-react";
import { AssetCodes } from "@/components/asset-codes";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { TicketStatusBadge } from "@/components/ticket-badges";
import { Button } from "@/components/ui/button";
import { assetConditionLabels, assetHistoryLabels, assetStatusLabels } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { formatPropertyValue } from "@/modules/assets/properties";
import { getAsset, type AssetDetail } from "@/modules/assets/queries";
import { listLocations } from "@/modules/master/queries";
import { getBundle } from "@/modules/deployments/queries";
import { ticketScope } from "@/modules/tickets/queries";
import { AssetActions, SavedToast } from "./asset-actions";
import { BundlePanel } from "./bundle-panel";

export const metadata: Metadata = { title: "รายละเอียดครุภัณฑ์ | AMS" };

const fieldLabels: Record<string, string> = {
  name: "ชื่อ",
  brand: "ยี่ห้อ",
  model: "รุ่น",
  serialNumber: "Serial",
  barcode: "บาร์โค้ดผู้ผลิต",
  purchaseDate: "วันที่ซื้อ",
  warrantyExpiry: "ประกันหมดอายุ",
  cost: "ราคา",
  note: "หมายเหตุ",
  departmentId: "แผนก",
};

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });

function Card({ icon: Icon, title, children, className = "", delay = 0 }: { icon: typeof Package; title: string; children: ReactNode; className?: string; delay?: number }) {
  return (
    <section className={`animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6 ${className}`} style={{ animationDelay: `${delay}ms` }}>
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

function Info({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 wrap-break-word font-medium">{value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Resolve ids in history entries to names for display */
async function describeHistory(asset: AssetDetail) {
  const ids = new Set<string>();
  const assetIds = new Set<string>();
  const transferIds = new Set<string>();
  for (const h of asset.history) {
    for (const v of [h.fromValue, h.toValue]) {
      const obj = (v ?? {}) as Record<string, unknown>;
      if (typeof obj.ownerId === "string") ids.add(obj.ownerId);
      for (const k of ["parentId", "childId", "replacedBy", "replaces"]) if (typeof obj[k] === "string") assetIds.add(obj[k] as string);
    }
    if ((h.refType === "TRANSFER" || h.refType === "SWAP") && h.refId) transferIds.add(h.refId);
  }
  const [users, locations, assets, transfers] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } }),
    listLocations(),
    prisma.asset.findMany({ where: { id: { in: [...assetIds] } }, select: { id: true, assetCode: true } }),
    prisma.assetTransfer.findMany({ where: { id: { in: [...transferIds] } }, select: { id: true, docNumber: true } }),
  ]);
  const code = new Map(assets.map((a) => [a.id, a.assetCode]));
  const doc = new Map(transfers.map((t) => [t.id, t.docNumber]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const locPath = new Map(locations.map((l) => [l.id, l.path]));
  const pick = (v: unknown, key: string) => ((v ?? {}) as Record<string, string | null>)[key] ?? null;

  return asset.history.map((h) => {
    let detail: string | null = null;
    switch (h.event) {
      case "CREATED":
        detail = `รหัส ${pick(h.toValue, "assetCode")} สถานะ ${assetStatusLabels[pick(h.toValue, "status") as keyof typeof assetStatusLabels] ?? "-"}`;
        break;
      case "ASSIGNED":
        detail = `${userName.get(pick(h.fromValue, "ownerId") ?? "") ?? "ไม่มี"} → ${userName.get(pick(h.toValue, "ownerId") ?? "") ?? "ไม่มี"}`;
        break;
      case "MOVED":
        detail = `${locPath.get(pick(h.fromValue, "locationId") ?? "") ?? "ไม่ระบุ"} → ${locPath.get(pick(h.toValue, "locationId") ?? "") ?? "ไม่ระบุ"}`;
        break;
      case "STATUS_CHANGED": {
        const s = (k: unknown) => assetStatusLabels[k as keyof typeof assetStatusLabels] ?? "-";
        detail = `${s(pick(h.fromValue, "status"))} → ${s(pick(h.toValue, "status"))}${h.refType === "TICKET" ? " (จากงานแจ้งซ่อม)" : h.refType === "CLAIM" ? " (จากการเคลม)" : ""}`;
        break;
      }
      case "CONDITION_CHANGED": {
        const c = (k: unknown) => assetConditionLabels[k as keyof typeof assetConditionLabels] ?? "-";
        detail = `${c(pick(h.fromValue, "condition"))} → ${c(pick(h.toValue, "condition"))}`;
        break;
      }
      case "ATTACHED":
        detail = `เข้าชุด ${code.get(pick(h.toValue, "parentId") ?? "") ?? "-"}`;
        break;
      case "DETACHED":
        detail = `ออกจากชุด ${code.get(pick(h.fromValue, "parentId") ?? "") ?? "-"}`;
        break;
      case "SWAPPED": {
        const other = pick(h.toValue, "replacedBy") ?? pick(h.toValue, "replaces") ?? pick(h.toValue, "childId");
        detail = pick(h.toValue, "replacedBy") ? `ถูกแทนที่ด้วย ${code.get(other ?? "") ?? "-"}` : `รับแทน/ติดตั้ง ${code.get(other ?? "") ?? "-"}`;
        break;
      }
      case "PM_DONE": {
        const failed = Number(pick(h.toValue, "failed") ?? 0);
        detail = `${pick(h.toValue, "title") ?? ""}${failed ? ` · ไม่ผ่าน ${failed} รายการ` : " · ผ่านทุกรายการ"}`;
        break;
      }
      case "SERIAL_REPLACED":
        detail = `Serial ${pick(h.fromValue, "serialNumber") ?? "-"} → ${pick(h.toValue, "serialNumber") ?? "-"}`;
        break;
      case "UPDATED": {
        const keys = Object.keys((h.toValue ?? {}) as object);
        const defLabel = new Map(asset.category.propertyDefs.map((d) => [`prop.${d.key}`, d.label]));
        detail = keys.map((k) => fieldLabels[k] ?? defLabel.get(k) ?? k.replace(/^prop\./, "")).join(", ");
        break;
      }
    }
    const docNumber = h.refId ? doc.get(h.refId) : undefined;
    return { id: h.id, event: h.event, detail: docNumber ? `${detail ?? ""} (${docNumber})`.trim() : detail, actor: h.actorName, at: h.createdAt, ref: h.refType };
  });
}

export default async function AssetDetailPage({ params }: PageProps<"/assets/[id]">) {
  const session = await requirePermission("asset", "view");
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) notFound();
  const history = await describeHistory(asset);
  const role = session.user.role;
  const tickets = await prisma.ticket.findMany({
    where: { assetId: asset.id, ...ticketScope({ id: session.user.id, role }) },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, ticketNumber: true, title: true, status: true, createdAt: true },
  });

  const bundle = await getBundle(asset.id);
  const canDeploy = can(role, "deployment", "create") && !bundle.parent && !["IN_MAINTENANCE", "CLAIMING", "DISPOSED"].includes(asset.status);
  const canSwap = can(role, "deployment", "swap") && !bundle.parent;
  const canBundle = can(role, "deployment", "update");
  const attachCandidates = canBundle
    ? (
        await prisma.asset.findMany({
          where: {
            deletedAt: null,
            id: { not: asset.id },
            status: { notIn: ["IN_MAINTENANCE", "CLAIMING", "DISPOSED"] },
            asChild: { none: { status: "ACTIVE" } },
          },
          orderBy: { assetCode: "asc" },
          select: { id: true, assetCode: true, name: true },
          take: 500,
        })
      ).map((a) => ({ value: a.id, label: `${a.assetCode} ${a.name}` }))
    : [];
  const locationOptions = canBundle ? (await listLocations()).map((l) => ({ value: l.id, label: l.path })) : [];

  const knownKeys = new Set(asset.category.propertyDefs.map((d) => d.key));
  const orphanProps = Object.entries(asset.propertyValues).filter(([k]) => !knownKeys.has(k));
  const warrantyExpired = asset.warrantyExpiry ? new Date(asset.warrantyExpiry) < new Date() : false;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Suspense>
        <SavedToast />
      </Suspense>
      <PageHeader
        icon={Package}
        tone="orange"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{asset.assetCode}</span>
            <AssetStatusBadge status={asset.status} />
          </span>
        }
        description={`${asset.name} · ${asset.category.name}`}
        actions={
          <>
            {can(role, "claim", "create") && !["CLAIMING", "DISPOSED"].includes(asset.status) && (
              <Button asChild variant="outline" className="h-10 rounded-xl">
                <Link href={`/claims/new?asset=${asset.id}`}>
                  <Store /> ส่งเคลม
                </Link>
              </Button>
            )}
            {can(role, "ticket", "create") && (
              <Button asChild variant="outline" className="h-10 rounded-xl">
                <Link href={`/tickets/new?asset=${encodeURIComponent(asset.assetCode)}`}>
                  <Wrench /> แจ้งซ่อม
                </Link>
              </Button>
            )}
            <AssetActions id={asset.id} assetCode={asset.assetCode} canUpdate={can(role, "asset", "update")} canDelete={can(role, "asset", "delete")} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card icon={Package} title="ข้อมูลครุภัณฑ์" delay={60}>
            <Info
              items={[
                ["ชื่อ", asset.name],
                ["ประเภท", `${asset.category.name} (${asset.category.codePrefix})`],
                ["ยี่ห้อ", asset.brand],
                ["รุ่น", asset.model],
                ["Serial Number", asset.serialNumber && <span className="font-mono">{asset.serialNumber}</span>],
                ["บาร์โค้ดผู้ผลิต", asset.barcode],
                ["สภาพ", assetConditionLabels[asset.condition]],
                ["ราคา", asset.cost ? money.format(Number(asset.cost)) : null],
                ["วันที่ซื้อ", asset.purchaseDate && formatDate(asset.purchaseDate)],
                [
                  "ประกันหมดอายุ",
                  asset.warrantyExpiry && (
                    <span className={warrantyExpired ? "text-destructive" : ""}>
                      {formatDate(asset.warrantyExpiry)}
                      {warrantyExpired && " (หมดแล้ว)"}
                    </span>
                  ),
                ],
              ]}
            />
            {asset.note && <p className="mt-4 whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm">{asset.note}</p>}
          </Card>

          {(asset.category.propertyDefs.length > 0 || orphanProps.length > 0) && (
            <Card icon={SlidersHorizontal} title={`ข้อมูลเฉพาะ: ${asset.category.name}`} delay={120}>
              <Info
                items={[
                  ...asset.category.propertyDefs.map((d): [string, ReactNode] => [d.label, formatPropertyValue(d.type, asset.propertyValues[d.key])]),
                  ...orphanProps.map(([k, v]): [string, ReactNode] => [`${k} (เลิกใช้)`, v]),
                ]}
              />
            </Card>
          )}

          {(bundle.parent || bundle.children.length > 0 || canBundle) && (
            <Card icon={Boxes} title={`ชุดอุปกรณ์ (Bundle)${bundle.children.length ? ` · ${bundle.children.length} ชิ้น` : ""}`} delay={140}>
              <BundlePanel
                assetId={asset.id}
                parent={bundle.parent ? { ...bundle.parent.parent, type: bundle.parent.type } : null}
                items={bundle.children.map((r) => ({ relationshipId: r.id, type: r.type, ...r.child }))}
                candidates={attachCandidates}
                locations={locationOptions}
                canEdit={canBundle}
              />
            </Card>
          )}

          {tickets.length > 0 && (
            <Card icon={Headset} title={`งานแจ้งซ่อม (${tickets.length})`} delay={150}>
              <ul className="divide-y divide-border">
                {tickets.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`/tickets/${t.id}`} className="min-w-0 flex-1 hover:text-primary">
                      <span className="font-mono text-sm font-semibold">{t.ticketNumber}</span> <span className="text-sm">{t.title}</span>
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {formatDate(t.createdAt)} <TicketStatusBadge status={t.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card icon={History} title="ประวัติ" delay={180}>
            <ol className="relative space-y-4 border-l border-border pl-5">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[26.5px] top-1.5 size-3 rounded-full border-2 border-card bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{assetHistoryLabels[h.event] ?? h.event}</span>
                    {h.ref === "BULK" && <span className="text-xs text-muted-foreground">(เพิ่มหลายรายการ)</span>}
                    {h.ref === "IMPORT" && <span className="text-xs text-muted-foreground">(นำเข้า)</span>}
                  </div>
                  {h.detail && <p className="text-sm text-foreground/80">{h.detail}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(h.at)}
                    {h.actor && ` · ${h.actor}`}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card icon={MapPin} title="ผู้ถือครองและสถานที่" delay={90}>
            <dl className="space-y-3">
              {(
                [
                  ["ผู้ถือครอง", asset.owner?.name],
                  ["แผนก", asset.department?.name],
                  ["สถานที่", asset.locationPath],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-medium">{value ?? "-"}</dd>
                </div>
              ))}
            </dl>
            {(canDeploy || canSwap) && (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {canDeploy && (
                  <Button asChild variant="outline" className="h-10 rounded-xl">
                    <Link href={`/deployments/new?asset=${asset.id}&type=${asset.ownerId ? "RETURN" : "HANDOVER"}`}>
                      <PackageCheck /> {asset.ownerId ? "คืน / ย้าย / ส่งมอบต่อ" : "ส่งมอบ / ย้าย"}
                    </Link>
                  </Button>
                )}
                {canSwap && (
                  <Button asChild variant="outline" className="h-10 rounded-xl">
                    <Link href={`/deployments/swap?mode=${bundle.children.length ? "partial" : "full"}&asset=${asset.id}`}>
                      <Repeat /> เปลี่ยนเครื่อง (Swap)
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </Card>
          <Card icon={QrCode} title="QR Code / Barcode" delay={150}>
            <AssetCodes assetCode={asset.assetCode} />
            {can(role, "asset", "printLabel") && can(role, "label", "view") && (
              <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-lg">
                <Link href={`/labels/print?assets=${asset.id}`}>
                  <Printer /> พิมพ์ฉลาก
                </Link>
              </Button>
            )}
          </Card>
          <p className="px-2 text-xs text-muted-foreground">
            ลงทะเบียนเมื่อ {formatDateTime(asset.createdAt)} · แก้ไขล่าสุด {formatDateTime(asset.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import type { AuditDecision, Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { activeDescendants } from "@/modules/deployments/service";
import { campaignSchema, type CampaignInput } from "./schemas";
import { createMissingRecords, needsDecision } from "./service";

const toDate = (v: string) => new Date(`${v}T00:00:00.000Z`);

async function actor(action: "create" | "update" | "delete" | "approve") {
  const session = await requirePermission("audit", action);
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };
}

function revalidate(id?: string) {
  revalidatePath("/audits");
  if (id) revalidatePath(`/audits/${id}`);
}

/** Create or edit a campaign. Scope and auditors can only change while it is still a draft. */
export async function saveCampaign(_prev: FormState<CampaignInput>, formData: FormData): Promise<FormState<CampaignInput>> {
  const raw = formDataToObject(formData);
  const who = await actor(raw.id ? "update" : "create");
  const parsed = campaignSchema.safeParse(raw);
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const [locCount, auditors] = await Promise.all([
    prisma.location.count({ where: { id: { in: d.scopeLocationIds }, deletedAt: null } }),
    prisma.user.findMany({ where: { id: { in: d.auditorIds }, banned: false }, select: { id: true } }),
  ]);
  if (locCount !== d.scopeLocationIds.length) return { fieldErrors: { scopeLocationIds: ["พบสถานที่ที่ไม่มีอยู่ในระบบ"] } };
  if (auditors.length !== d.auditorIds.length) return { fieldErrors: { auditorIds: ["พบผู้ใช้ที่ไม่มีอยู่ในระบบ"] } };

  const data = {
    title: d.title,
    year: d.year,
    startDate: toDate(d.startDate),
    endDate: toDate(d.endDate),
    note: d.note ?? null,
  };

  if (d.id) {
    const current = await prisma.auditCampaign.findUnique({ where: { id: d.id }, select: { status: true } });
    if (!current) return { message: "ไม่พบรอบตรวจนับ" };
    const draft = current.status === "DRAFT";
    if (current.status === "CLOSED") return { message: "รอบตรวจนับปิดแล้ว แก้ไขไม่ได้" };
    await prisma.$transaction(async (tx) => {
      await tx.auditCampaign.update({ where: { id: d.id }, data: { ...data, ...(draft ? { scopeLocationIds: d.scopeLocationIds } : {}) } });
      // Auditors may be added later (e.g. extra staff mid-count); scope is fixed once scanning starts
      await tx.auditCampaignAuditor.deleteMany({ where: { campaignId: d.id } });
      await tx.auditCampaignAuditor.createMany({ data: d.auditorIds.map((userId) => ({ campaignId: d.id!, userId })) });
      await logAction({ ...who, action: "UPDATE", module: "audit", entityId: d.id, details: { title: d.title, auditors: d.auditorIds.length } }, tx);
    });
    revalidate(d.id);
    return { ok: true, message: "บันทึกรอบตรวจนับแล้ว", data: { id: d.id } };
  }

  const id = await prisma.$transaction(async (tx) => {
    const c = await tx.auditCampaign.create({
      data: { ...data, scopeLocationIds: d.scopeLocationIds, createdById: who.userId, auditors: { create: d.auditorIds.map((userId) => ({ userId })) } },
    });
    await logAction({ ...who, action: "CREATE", module: "audit", entityId: c.id, details: { title: d.title, locations: d.scopeLocationIds.length, auditors: d.auditorIds.length } }, tx);
    return c.id;
  });
  revalidate();
  return { ok: true, message: "สร้างรอบตรวจนับแล้ว", data: { id } };
}

export async function deleteCampaign(id: string): Promise<FormState> {
  const who = await actor("delete");
  const c = await prisma.auditCampaign.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!c) return { message: "ไม่พบรอบตรวจนับ" };
  if (c.status !== "DRAFT") return { message: "ลบได้เฉพาะรอบที่ยังเป็นฉบับร่าง" };
  await prisma.$transaction(async (tx) => {
    await tx.auditCampaign.delete({ where: { id } });
    await logAction({ ...who, action: "DELETE", module: "audit", entityId: id, details: { title: c.title } }, tx);
  });
  revalidate();
  return { ok: true, message: "ลบรอบตรวจนับแล้ว" };
}

export async function startCampaign(id: string): Promise<FormState> {
  const who = await actor("update");
  const c = await prisma.auditCampaign.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!c) return { message: "ไม่พบรอบตรวจนับ" };
  if (c.status !== "DRAFT") return { message: "รอบนี้เริ่มไปแล้ว" };
  await prisma.$transaction(async (tx) => {
    await tx.auditCampaign.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    await logAction({ ...who, action: "START", module: "audit", entityId: id, details: { title: c.title } }, tx);
  });
  revalidate(id);
  return { ok: true, message: "เริ่มตรวจนับแล้ว" };
}

/** Stop scanning; in-scope assets that were never scanned become MISSING. */
export async function completeCampaign(id: string): Promise<FormState> {
  const who = await actor("update");
  const c = await prisma.auditCampaign.findUnique({ where: { id } });
  if (!c) return { message: "ไม่พบรอบตรวจนับ" };
  if (c.status !== "IN_PROGRESS") return { message: "ปิดการสแกนได้เฉพาะรอบที่กำลังตรวจนับ" };
  const missing = await prisma.$transaction(async (tx) => {
    const n = await createMissingRecords(tx, c);
    await tx.auditCampaign.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await logAction({ ...who, action: "COMPLETE", module: "audit", entityId: id, details: { title: c.title, missing: n } }, tx);
    return n;
  }, { timeout: 60_000 });
  revalidate(id);
  return { ok: true, message: missing ? `ปิดการสแกนแล้ว ไม่พบ ${missing} รายการ` : "ปิดการสแกนแล้ว พบครบทุกรายการ" };
}

/**
 * Approve (APPLY) or ignore differences. Master data changes only here (CLAUDE.md §8):
 * RELOCATED → move the asset (and its bundle), MISSING → PENDING_DISPOSAL, condition differences → update condition.
 */
export async function reconcileRecords(campaignId: string, recordIds: string[], decision: AuditDecision): Promise<FormState> {
  const who = await actor("approve");
  if (!recordIds.length || recordIds.length > 5000) return { message: "กรุณาเลือกรายการ" };
  if (decision !== "APPLY" && decision !== "IGNORE") return { message: "คำสั่งไม่ถูกต้อง" };
  const c = await prisma.auditCampaign.findUnique({ where: { id: campaignId }, select: { status: true, title: true } });
  if (!c) return { message: "ไม่พบรอบตรวจนับ" };
  if (c.status !== "COMPLETED") return { message: "อนุมัติได้หลังปิดการสแกนและก่อนปิดรอบเท่านั้น" };

  const records = await prisma.auditRecord.findMany({
    where: { id: { in: recordIds }, campaignId, reconciled: false },
    include: { asset: { select: { id: true, status: true, condition: true, locationId: true, deletedAt: true } } },
  });
  const pending = records.filter((r) => needsDecision(r, r.asset?.condition ?? null));
  if (!pending.length) return { message: "ไม่มีรายการที่ต้องตัดสินใจ" };

  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of pending) {
      const a = r.asset;
      if (decision === "APPLY" && a && !a.deletedAt) {
        const ref = { refType: "AUDIT", refId: campaignId, actorId: who.userId };
        const history: Prisma.AssetHistoryCreateManyInput[] = [];

        if (r.result === "RELOCATED" && r.actualLocationId && r.actualLocationId !== a.locationId) {
          // Children follow their parent (CLAUDE.md §8)
          const ids = [a.id, ...(await activeDescendants(tx, a.id))];
          const moving = await tx.asset.findMany({ where: { id: { in: ids } }, select: { id: true, locationId: true } });
          await tx.asset.updateMany({ where: { id: { in: ids } }, data: { locationId: r.actualLocationId } });
          for (const m of moving) {
            if (m.locationId !== r.actualLocationId) history.push({ assetId: m.id, event: "MOVED", fromValue: { locationId: m.locationId }, toValue: { locationId: r.actualLocationId }, ...ref });
          }
        }
        if (r.result === "MISSING" && a.status !== "DISPOSED" && a.status !== "PENDING_DISPOSAL") {
          await tx.asset.update({ where: { id: a.id }, data: { status: "PENDING_DISPOSAL" } });
          history.push({ assetId: a.id, event: "AUDIT_MISSING", fromValue: { status: a.status }, toValue: { status: "PENDING_DISPOSAL" }, ...ref });
        }
        if (r.result !== "MISSING" && r.condition !== a.condition) {
          await tx.asset.update({ where: { id: a.id }, data: { condition: r.condition } });
          history.push({ assetId: a.id, event: "CONDITION_CHANGED", fromValue: { condition: a.condition }, toValue: { condition: r.condition }, ...ref });
        }
        if (history.length) {
          await tx.assetHistory.createMany({ data: history });
          changed++;
        }
      }
      await tx.auditRecord.update({ where: { id: r.id }, data: { reconciled: true, decision, reconciledById: who.userId, reconciledAt: new Date() } });
    }
    await logAction(
      { ...who, action: decision === "APPLY" ? "RECONCILE_APPLY" : "RECONCILE_IGNORE", module: "audit", entityId: campaignId, details: { title: c.title, records: pending.map((r) => r.scannedCode), changed } },
      tx,
    );
  }, { timeout: 120_000 });

  revalidate(campaignId);
  return { ok: true, message: decision === "APPLY" ? `อนุมัติ ${pending.length} รายการ (ปรับปรุงข้อมูล ${changed} รายการ)` : `ข้าม ${pending.length} รายการ` };
}

/** Apply the same decision to every record still waiting for one. */
export async function reconcileAll(campaignId: string, decision: AuditDecision): Promise<FormState> {
  await actor("approve");
  const open = await prisma.auditRecord.findMany({ where: { campaignId, reconciled: false }, select: { id: true } });
  if (!open.length) return { message: "ไม่มีรายการที่ต้องตัดสินใจ" };
  return reconcileRecords(campaignId, open.map((r) => r.id), decision);
}

export async function closeCampaign(id: string): Promise<FormState> {
  const who = await actor("approve");
  const c = await prisma.auditCampaign.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!c) return { message: "ไม่พบรอบตรวจนับ" };
  if (c.status !== "COMPLETED") return { message: "ปิดรอบได้หลังปิดการสแกนแล้วเท่านั้น" };
  const open = await prisma.auditRecord.findMany({
    where: { campaignId: id, reconciled: false },
    select: { result: true, condition: true, asset: { select: { condition: true } } },
  });
  const undecided = open.filter((r) => needsDecision(r, r.asset?.condition ?? null)).length;
  if (undecided) return { message: `ยังมี ${undecided} รายการที่ยังไม่ได้อนุมัติหรือข้าม` };
  await prisma.$transaction(async (tx) => {
    await tx.auditCampaign.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
    await logAction({ ...who, action: "CLOSE", module: "audit", entityId: id, details: { title: c.title } }, tx);
  });
  revalidate(id);
  return { ok: true, message: "ปิดรอบตรวจนับแล้ว" };
}

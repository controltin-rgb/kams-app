"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { emitPmEvent } from "@/modules/office3d/emit";
import { checklistSchema, completeRunSchema, scheduleSchema, type ChecklistResult, type CompleteRunInput, type ScheduleInput } from "./schemas";
import { bangkokToday, firstOccurrence } from "./dates";
import { generatePmRuns } from "./service";

async function actor(action: "create" | "update" | "delete" | "execute") {
  const session = await requirePermission("pm", action);
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };
}

function refresh() {
  revalidatePath("/pm");
  revalidatePath("/pm/schedules");
}

// ---------- Schedules ----------

export async function saveSchedule(_prev: FormState<ScheduleInput>, formData: FormData): Promise<FormState<ScheduleInput>> {
  const parsed = scheduleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id, checklist, startDate, ...f } = parsed.data;
  const who = await actor(id ? "update" : "create");

  const [asset, location, tech] = await Promise.all([
    f.assetId ? prisma.asset.findFirst({ where: { id: f.assetId, deletedAt: null }, select: { id: true, locationId: true } }) : null,
    f.locationId ? prisma.location.findFirst({ where: { id: f.locationId, deletedAt: null }, select: { id: true } }) : null,
    f.assignedTechId ? prisma.user.findFirst({ where: { id: f.assignedTechId, banned: false }, select: { id: true } }) : null,
  ]);
  if (f.assetId && !asset) return { fieldErrors: { assetId: ["ไม่พบครุภัณฑ์"] } };
  if (f.locationId && !location) return { fieldErrors: { locationId: ["ไม่พบสถานที่"] } };
  if (f.assignedTechId && !tech) return { fieldErrors: { assignedTechId: ["ไม่พบผู้ใช้"] } };
  if (!f.assetId && !f.locationId) return { fieldErrors: { assetId: ["เลือกครุภัณฑ์หรือสถานที่อย่างน้อยหนึ่งอย่าง"] } };

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const today = bangkokToday();
  const data = {
    title: f.title,
    description: f.description ?? null,
    assetId: f.assetId ?? null,
    locationId: f.locationId ?? (asset?.locationId ?? null),
    frequency: f.frequency,
    startDate: start,
    assignedTechId: f.assignedTechId ?? null,
    checklistTemplate: checklist as Prisma.InputJsonValue,
    active: id ? f.active : true,
  };

  const savedId = await prisma.$transaction(async (tx) => {
    if (id) {
      const current = await tx.pmSchedule.findUniqueOrThrow({ where: { id } });
      const timingChanged = current.frequency !== f.frequency || current.startDate.getTime() !== start.getTime();
      if (timingChanged) {
        // Re-plan: drop upcoming runs that were not started yet; past/done runs stay as history
        await tx.pmRun.deleteMany({ where: { scheduleId: id, status: "SCHEDULED", dueDate: { gte: today } } });
      }
      await tx.pmSchedule.update({
        where: { id },
        data: { ...data, ...(timingChanged ? { nextDueDate: firstOccurrence(start, f.frequency, today) } : {}) },
      });
      await logAction({ ...who, action: "UPDATE", module: "pm", entityId: id, details: { title: f.title, timingChanged } }, tx);
      return id;
    }
    const s = await tx.pmSchedule.create({ data: { ...data, nextDueDate: firstOccurrence(start, f.frequency, today) } });
    await logAction({ ...who, action: "CREATE", module: "pm", entityId: s.id, details: { title: f.title, frequency: f.frequency } }, tx);
    return s.id;
  });

  await generatePmRuns();
  refresh();
  return { ok: true, message: id ? "บันทึกแผน PM แล้ว" : "สร้างแผน PM แล้ว", data: { id: savedId } };
}

export async function setScheduleActive(id: string, active: boolean): Promise<FormState> {
  const who = await actor("update");
  await prisma.$transaction(async (tx) => {
    await tx.pmSchedule.update({ where: { id }, data: { active } });
    if (!active) await tx.pmRun.deleteMany({ where: { scheduleId: id, status: "SCHEDULED", dueDate: { gte: bangkokToday() } } });
    await logAction({ ...who, action: active ? "ACTIVATE" : "DEACTIVATE", module: "pm", entityId: id }, tx);
  });
  if (active) await generatePmRuns();
  refresh();
  return { ok: true, message: active ? "เปิดใช้แผนแล้ว" : "ปิดใช้แผนแล้ว (ลบงานที่ยังไม่ถึงกำหนด)" };
}

export async function deleteSchedule(id: string): Promise<FormState> {
  const who = await actor("delete");
  const done = await prisma.pmRun.count({ where: { scheduleId: id, status: { in: ["DONE", "IN_PROGRESS", "SKIPPED"] } } });
  if (done) return { message: "แผนนี้มีประวัติการทำ PM แล้ว — ใช้ 'ปิดใช้' แทนการลบ" };
  await prisma.$transaction(async (tx) => {
    const s = await tx.pmSchedule.delete({ where: { id } });
    await logAction({ ...who, action: "DELETE", module: "pm", entityId: id, details: { title: s.title } }, tx);
  });
  refresh();
  return { ok: true, message: "ลบแผน PM แล้ว" };
}

// ---------- Runs ----------

async function loadRun(runId: string) {
  return prisma.pmRun.findUnique({ where: { id: runId }, include: { schedule: true } });
}

export async function startRun(runId: string): Promise<FormState> {
  const who = await actor("execute");
  const run = await loadRun(runId);
  if (!run) return { message: "ไม่พบงาน PM" };
  if (!["SCHEDULED", "OVERDUE"].includes(run.status)) return { message: "งานนี้เริ่มหรือปิดไปแล้ว" };
  await prisma.$transaction(async (tx) => {
    await tx.pmRun.update({ where: { id: runId }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    await logAction({ ...who, action: "START_RUN", module: "pm", entityId: run.scheduleId, details: { runId } }, tx);
    await emitPmEvent(tx, "PM_STARTED", run, who.userId);
  });
  revalidatePath(`/pm/runs/${runId}`);
  refresh();
  return { ok: true, message: "เริ่มทำ PM แล้ว" };
}

/** Save the checklist and close the run. Failed items are recorded only (no automatic ticket). */
export async function completeRun(input: CompleteRunInput): Promise<FormState> {
  const who = await actor("execute");
  const parsed = completeRunSchema.safeParse(input);
  if (!parsed.success) return { message: "ข้อมูลไม่ถูกต้อง" };
  const run = await loadRun(parsed.data.runId);
  if (!run) return { message: "ไม่พบงาน PM" };
  if (["DONE", "SKIPPED"].includes(run.status)) return { message: "งานนี้ปิดไปแล้ว" };

  const items = checklistSchema.safeParse(run.schedule.checklistTemplate);
  if (!items.success) return { message: "แม่แบบรายการตรวจเสียหาย กรุณาแก้ไขแผน PM" };
  const answers = new Map(parsed.data.results.map((r) => [r.itemId, r.value.trim()]));

  const results: ChecklistResult[] = [];
  const missing: string[] = [];
  for (const item of items.data) {
    const value = answers.get(item.id) ?? "";
    if (item.required && !value) missing.push(item.label);
    if (item.type === "NUMBER" && value && !/^-?\d+(\.\d+)?$/.test(value)) return { message: `${item.label}: ต้องเป็นตัวเลข` };
    if (item.type === "CHECK" && value && !["pass", "fail"].includes(value)) return { message: `${item.label}: ค่าไม่ถูกต้อง` };
    results.push({ itemId: item.id, label: item.label, type: item.type, unit: item.unit, value, pass: item.type === "CHECK" ? (value ? value === "pass" : null) : null });
  }
  if (missing.length) return { message: `ยังไม่ได้บันทึก: ${missing.join(", ")}` };
  const failed = results.filter((r) => r.pass === false).length;

  await prisma.$transaction(async (tx) => {
    await tx.pmRun.update({
      where: { id: run.id },
      data: {
        status: "DONE",
        checklistResult: results as Prisma.InputJsonValue,
        notes: parsed.data.notes ?? null,
        doneById: who.userId,
        doneAt: new Date(),
        startedAt: run.startedAt ?? new Date(),
      },
    });
    if (run.schedule.assetId) {
      await tx.assetHistory.create({
        data: { assetId: run.schedule.assetId, event: "PM_DONE", toValue: { title: run.schedule.title, failed }, refType: "PM", refId: run.id, actorId: who.userId },
      });
    }
    await logAction({ ...who, action: "COMPLETE_RUN", module: "pm", entityId: run.scheduleId, details: { runId: run.id, items: results.length, failed } }, tx);
    await emitPmEvent(tx, "PM_DONE", run, who.userId, failed);
  });
  revalidatePath(`/pm/runs/${run.id}`);
  refresh();
  return { ok: true, message: failed ? `บันทึก PM แล้ว (ไม่ผ่าน ${failed} รายการ)` : "บันทึก PM แล้ว ผ่านทุกรายการ" };
}

const skipSchema = z.object({ runId: z.string().min(1), reason: z.string({ error: "กรุณาระบุเหตุผล" }).min(1, "กรุณาระบุเหตุผล").max(500) });

export async function skipRun(_prev: FormState<z.input<typeof skipSchema>>, formData: FormData): Promise<FormState<z.input<typeof skipSchema>>> {
  const who = await actor("execute");
  const parsed = skipSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const run = await loadRun(parsed.data.runId);
  if (!run) return { message: "ไม่พบงาน PM" };
  if (["DONE", "SKIPPED"].includes(run.status)) return { message: "งานนี้ปิดไปแล้ว" };
  await prisma.$transaction(async (tx) => {
    await tx.pmRun.update({ where: { id: run.id }, data: { status: "SKIPPED", notes: parsed.data.reason, doneById: who.userId, doneAt: new Date() } });
    await logAction({ ...who, action: "SKIP_RUN", module: "pm", entityId: run.scheduleId, details: { runId: run.id, reason: parsed.data.reason } }, tx);
  });
  revalidatePath(`/pm/runs/${run.id}`);
  refresh();
  return { ok: true, message: "บันทึกการข้ามงาน PM แล้ว" };
}

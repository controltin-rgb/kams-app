"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getSettings, setSetting } from "@/lib/settings";

const hours = z.coerce.number({ error: "กรอกเป็นตัวเลข" }).int("ต้องเป็นจำนวนเต็ม").min(1, "อย่างน้อย 1 ชั่วโมง").max(2160, "ไม่เกิน 2160 ชั่วโมง (90 วัน)");

const ticketSettingsSchema = z.object({
  orgName: z.string({ error: "กรุณากรอกชื่อหน่วยงาน" }).min(1, "กรุณากรอกชื่อหน่วยงาน").max(200, "ยาวเกิน 200 ตัวอักษร"),
  slaLOW: hours,
  slaMEDIUM: hours,
  slaHIGH: hours,
  slaCRITICAL: hours,
  pmLeadDays: z.coerce.number({ error: "กรอกเป็นตัวเลข" }).int("ต้องเป็นจำนวนเต็ม").min(0, "อย่างน้อย 0 วัน").max(90, "ไม่เกิน 90 วัน"),
  allowAnonymousQr: z
    .literal("true")
    .optional()
    .transform((v) => v === "true"),
});
export type TicketSettingsInput = z.input<typeof ticketSettingsSchema>;

export async function saveTicketSettings(_prev: FormState<TicketSettingsInput>, formData: FormData): Promise<FormState<TicketSettingsInput>> {
  const session = await requirePermission("system", "editInfo");
  const parsed = ticketSettingsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const before = await getSettings();
  const sla = { LOW: d.slaLOW, MEDIUM: d.slaMEDIUM, HIGH: d.slaHIGH, CRITICAL: d.slaCRITICAL };
  await prisma.$transaction(async (tx) => {
    await setSetting(tx, "org.name", d.orgName);
    await setSetting(tx, "ticket.slaHours", sla);
    await setSetting(tx, "ticket.allowAnonymousQr", d.allowAnonymousQr);
    await setSetting(tx, "pm.leadDays", d.pmLeadDays);
    await logAction(
      {
        userId: session.user.id,
        impersonatedBy: session.session.impersonatedBy,
        action: "UPDATE_SETTINGS",
        module: "system",
        details: {
          before: { orgName: before["org.name"], slaHours: before["ticket.slaHours"], allowAnonymousQr: before["ticket.allowAnonymousQr"], pmLeadDays: before["pm.leadDays"] },
          after: { orgName: d.orgName, slaHours: sla, allowAnonymousQr: d.allowAnonymousQr, pmLeadDays: d.pmLeadDays },
        },
      },
      tx,
    );
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "บันทึกการตั้งค่าแล้ว (SLA ใหม่ใช้กับงานที่เปิดหลังจากนี้)" };
}

const systemInfoSchema = z.object({
  releaseNotes: z.string().max(20000, "ยาวเกิน 20,000 ตัวอักษร").optional(),
  roadmap: z.string().max(20000, "ยาวเกิน 20,000 ตัวอักษร").optional(),
});
export type SystemInfoInput = z.input<typeof systemInfoSchema>;

/** Release notes and roadmap shown on the System Info page. */
export async function saveSystemInfo(_prev: FormState<SystemInfoInput>, formData: FormData): Promise<FormState<SystemInfoInput>> {
  const session = await requirePermission("system", "editInfo");
  const parsed = systemInfoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  await prisma.$transaction(async (tx) => {
    await setSetting(tx, "system.releaseNotes", parsed.data.releaseNotes ?? "");
    await setSetting(tx, "system.roadmap", parsed.data.roadmap ?? "");
    await logAction({ userId: session.user.id, impersonatedBy: session.session.impersonatedBy, action: "UPDATE_SETTINGS", module: "system", details: { keys: ["system.releaseNotes", "system.roadmap"] } }, tx);
  });
  revalidatePath("/admin/system-info");
  return { ok: true, message: "บันทึกแล้ว" };
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { currentYear, nextSequence } from "@/lib/sequence";
import { getSession, requirePermission, requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { ticketStatusLabels } from "@/lib/labels";
import { queueNotify } from "@/modules/notifications/service";
import { emitAssetStatusEvent, emitTicketEvent } from "@/modules/office3d/emit";
import { deleteStoredFile, MAX_UPLOAD_BYTES, saveFile, sniffType } from "@/lib/storage";
import { listAssignableTechs } from "./queries";
import {
  assignSchema,
  commentSchema,
  createTicketSchema,
  partSchema,
  prioritySchema,
  publicTicketSchema,
  repairInfoSchema,
  statusChangeSchema,
  type CommentInput,
  type CreateTicketInput,
  type PartInput,
  type PublicTicketInput,
  type RepairInfoInput,
  type StatusChangeInput,
} from "./schemas";
import { ticketAbilities } from "./workflow";

type Tx = Prisma.TransactionClient;
type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

const HOUR = 3_600_000;
const PUBLIC_REPORTS_PER_HOUR = 5;

async function nextTicketNumber(tx: Tx) {
  const year = currentYear();
  const n = await nextSequence(tx, "TCK", year);
  return `TCK-${year}-${String(n).padStart(4, "0")}`;
}

async function dueAtFor(priority: keyof Awaited<ReturnType<typeof getSettings>>["ticket.slaHours"], from: Date) {
  const sla = (await getSettings())["ticket.slaHours"];
  return new Date(from.getTime() + sla[priority] * HOUR);
}

function who(session: Session) {
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };
}

/** Put the asset into maintenance while the ticket is open (only if it is not already there). */
async function startAssetMaintenance(tx: Tx, assetId: string, ticketId: string, actorId: string | null) {
  const asset = await tx.asset.findUnique({ where: { id: assetId }, select: { status: true } });
  if (!asset || asset.status === "IN_MAINTENANCE") return null;
  await tx.asset.update({ where: { id: assetId }, data: { status: "IN_MAINTENANCE" } });
  await tx.assetHistory.create({
    data: { assetId, event: "STATUS_CHANGED", fromValue: { status: asset.status }, toValue: { status: "IN_MAINTENANCE" }, refType: "TICKET", refId: ticketId, actorId },
  });
  await emitAssetStatusEvent(tx, assetId, "IN_MAINTENANCE", actorId);
  return asset.status;
}

/** Restore the asset's previous status when its ticket is closed or cancelled. */
async function endAssetMaintenance(tx: Tx, ticket: { id: string; assetId: string | null; previousAssetStatus: Prisma.TicketGetPayload<object>["previousAssetStatus"] }, actorId: string) {
  if (!ticket.assetId || !ticket.previousAssetStatus) return;
  const asset = await tx.asset.findUnique({ where: { id: ticket.assetId }, select: { status: true } });
  if (asset?.status !== "IN_MAINTENANCE") return; // changed by something else meanwhile
  await tx.asset.update({ where: { id: ticket.assetId }, data: { status: ticket.previousAssetStatus } });
  await tx.assetHistory.create({
    data: {
      assetId: ticket.assetId,
      event: "STATUS_CHANGED",
      fromValue: { status: "IN_MAINTENANCE" },
      toValue: { status: ticket.previousAssetStatus },
      refType: "TICKET",
      refId: ticket.id,
      actorId,
    },
  });
  await emitAssetStatusEvent(tx, ticket.assetId, ticket.previousAssetStatus, actorId);
}

async function recomputeRepairCost(tx: Tx, ticketId: string) {
  const [ticket, parts] = await Promise.all([
    tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { laborCost: true } }),
    tx.ticketPart.findMany({ where: { ticketId }, select: { qty: true, unitCost: true } }),
  ]);
  const total = parts.reduce((sum, p) => sum.add(p.unitCost.mul(p.qty)), new Prisma.Decimal(0)).add(ticket.laborCost);
  await tx.ticket.update({ where: { id: ticketId }, data: { repairCost: total } });
}

/** Load a ticket with the caller's abilities, or null when the caller may not see it. */
async function loadForAction(ticketId: string) {
  const session = await requireSession();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  const abilities = ticketAbilities({ id: session.user.id, role: session.user.role }, ticket);
  if (!abilities.view) return null;
  return { session, ticket, abilities };
}

const NOT_FOUND = { message: "ไม่พบงานแจ้งซ่อม หรือไม่มีสิทธิ์เข้าถึง" };
const DENIED = { message: "ไม่มีสิทธิ์ทำรายการนี้" };

function done(ticketId: string, message: string) {
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { ok: true, message };
}

// ---------- Create ----------

export async function createTicket(_prev: FormState<CreateTicketInput>, formData: FormData): Promise<FormState<CreateTicketInput>> {
  const session = await requirePermission("ticket", "create");
  const parsed = createTicketSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const f = parsed.data;

  // Anyone may report a problem with any asset (e.g. a shared printer scanned by QR);
  // the asset picker only lists a regular user's own assets for convenience.
  if (f.assetId) {
    const asset = await prisma.asset.findFirst({ where: { id: f.assetId, deletedAt: null }, select: { id: true } });
    if (!asset) return { fieldErrors: { assetId: ["ไม่พบครุภัณฑ์"] } };
  }

  const now = new Date();
  const dueAt = await dueAtFor(f.priority, now);
  const { id, ticketNumber } = await prisma.$transaction(async (tx) => {
    const ticketNumber = await nextTicketNumber(tx);
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        category: f.category,
        priority: f.priority,
        title: f.title,
        description: f.description ?? null,
        locationText: f.locationText ?? null,
        assetId: f.assetId ?? null,
        assetUnusable: !!f.assetId && f.assetUnusable,
        source: f.fromQr ? "QR" : "WEB",
        reporterId: session.user.id,
        dueAt,
        createdAt: now,
      },
    });
    if (ticket.assetId && ticket.assetUnusable) {
      const previous = await startAssetMaintenance(tx, ticket.assetId, ticket.id, session.user.id);
      if (previous) await tx.ticket.update({ where: { id: ticket.id }, data: { previousAssetStatus: previous } });
    }
    await tx.ticketActivity.create({ data: { ticketId: ticket.id, kind: "CREATED", actorId: session.user.id } });
    await emitTicketEvent(tx, "TICKET_CREATED", ticket, session.user.id);
    await logAction({ ...who(session), action: "CREATE", module: "ticket", entityId: ticket.id, details: { ticketNumber, title: f.title } }, tx);
    return { id: ticket.id, ticketNumber };
  });

  queueNotify({ event: "TICKET_CREATED", title: `แจ้งซ่อมใหม่ ${ticketNumber}`, body: f.title, href: `/tickets/${id}`, priority: f.priority, actorId: session.user.id });
  revalidatePath("/tickets");
  return { ok: true, message: "แจ้งซ่อมเรียบร้อยแล้ว", data: { id } };
}

/** Report from the public QR page. Requires login unless the setting allows anonymous reports. */
export async function createPublicTicket(_prev: FormState<PublicTicketInput>, formData: FormData): Promise<FormState<PublicTicketInput>> {
  const settings = await getSettings();
  if (!settings["ticket.allowAnonymousQr"]) return { message: "ต้องเข้าสู่ระบบก่อนแจ้งซ่อม" };

  const parsed = publicTicketSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    // Honeypot filled: pretend success without saving anything
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { ok: true, message: "ส่งเรื่องแจ้งซ่อมเรียบร้อยแล้ว" };
    return fieldErrors(parsed.error);
  }
  const f = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  const recent = await prisma.systemAuditLog.count({
    where: { action: "PUBLIC_REPORT", ip, createdAt: { gte: new Date(Date.now() - HOUR) } },
  });
  if (recent >= PUBLIC_REPORTS_PER_HOUR) return { message: "แจ้งซ่อมบ่อยเกินไป กรุณาลองใหม่ภายหลัง" };

  const asset = await prisma.asset.findFirst({ where: { assetCode: f.assetCode, deletedAt: null }, select: { id: true } });
  if (!asset) return { message: "ไม่พบครุภัณฑ์" };

  const now = new Date();
  const dueAt = await dueAtFor("MEDIUM", now);
  const { ticketId, ticketNumber } = await prisma.$transaction(async (tx) => {
    const ticketNumber = await nextTicketNumber(tx);
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        title: f.title,
        description: f.description ?? null,
        locationText: f.locationText ?? null,
        assetId: asset.id,
        assetUnusable: f.assetUnusable,
        source: "QR_PUBLIC",
        reporterName: f.reporterName,
        reporterContact: f.reporterContact,
        dueAt,
        createdAt: now,
      },
    });
    if (f.assetUnusable) {
      const previous = await startAssetMaintenance(tx, asset.id, ticket.id, null);
      if (previous) await tx.ticket.update({ where: { id: ticket.id }, data: { previousAssetStatus: previous } });
    }
    await tx.ticketActivity.create({ data: { ticketId: ticket.id, kind: "CREATED", body: `แจ้งโดย ${f.reporterName} (${f.reporterContact})` } });
    await emitTicketEvent(tx, "TICKET_CREATED", ticket, null);
    // logAction records the IP, which is also what the rate limit above counts
    await logAction({ action: "PUBLIC_REPORT", module: "ticket", entityId: ticket.id, details: { ticketNumber, assetCode: f.assetCode } }, tx);
    return { ticketId: ticket.id, ticketNumber };
  });

  queueNotify({ event: "TICKET_CREATED", title: `แจ้งซ่อมใหม่ ${ticketNumber} (จาก QR)`, body: `${f.title} — ${f.reporterName}`, href: `/tickets/${ticketId}`, priority: "MEDIUM" });

  revalidatePath("/tickets");
  return { ok: true, message: `ส่งเรื่องแจ้งซ่อมเรียบร้อยแล้ว เลขที่ ${ticketNumber}` };
}

// ---------- Workflow ----------

/** Scene event per target status; CANCELLED ends the ticket in the office like CLOSED. */
const statusEvents = {
  OPEN: "TICKET_UPDATED",
  IN_PROGRESS: "TICKET_STARTED",
  ON_HOLD: "TICKET_ON_HOLD",
  RESOLVED: "TICKET_RESOLVED",
  CLOSED: "TICKET_CLOSED",
  CANCELLED: "TICKET_CLOSED",
} as const;

export async function changeStatus(_prev: FormState<StatusChangeInput>, formData: FormData): Promise<FormState<StatusChangeInput>> {
  const parsed = statusChangeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { ticketId, status, note, resolution } = parsed.data;

  const ctx = await loadForAction(ticketId);
  if (!ctx) return NOT_FOUND;
  const { session, ticket, abilities } = ctx;
  if (!abilities.nextStatuses.includes(status)) return DENIED;

  const now = new Date();
  const data: Prisma.TicketUpdateInput = { status };
  if (status === "IN_PROGRESS") {
    if (!ticket.firstResponseAt && session.user.id !== ticket.reporterId) data.firstResponseAt = now;
    // A technician starting unassigned work takes it
    if (!ticket.assignedTechId && can(session.user.role, "ticket", "update")) data.assignedTech = { connect: { id: session.user.id } };
    if (ticket.status === "RESOLVED") data.resolvedAt = null; // reopened
  }
  if (status === "RESOLVED") {
    data.resolvedAt = now;
    data.resolution = resolution;
  }
  if (status === "CLOSED" || status === "CANCELLED") data.closedAt = now;
  data.onHoldReason = status === "ON_HOLD" ? (note ?? null) : null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId, status: ticket.status }, data });
    if (status === "CLOSED" || status === "CANCELLED") await endAssetMaintenance(tx, ticket, session.user.id);
    await tx.ticketActivity.create({
      data: {
        ticketId,
        kind: "STATUS_CHANGED",
        body: (status === "RESOLVED" ? resolution : note) ?? null,
        fromValue: { status: ticket.status },
        toValue: { status },
        actorId: session.user.id,
      },
    });
    await logAction({ ...who(session), action: "STATUS_CHANGE", module: "ticket", entityId: ticketId, details: { from: ticket.status, to: status } }, tx);
    await emitTicketEvent(tx, statusEvents[status], updated, session.user.id);
  });
  queueNotify({
    event: "TICKET_STATUS",
    title: `${ticket.ticketNumber}: ${ticketStatusLabels[status]}`,
    body: (status === "RESOLVED" ? resolution : note) ?? ticket.title,
    href: `/tickets/${ticketId}`,
    priority: ticket.priority,
    related: { reporter: ticket.reporterId, assignee: ticket.assignedTechId ?? (data.assignedTech ? session.user.id : null) },
    actorId: session.user.id,
  });
  return done(ticketId, "อัปเดตสถานะเรียบร้อยแล้ว");
}

export async function assignTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = assignSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { ticketId, assignedTechId } = parsed.data;

  const ctx = await loadForAction(ticketId);
  if (!ctx) return NOT_FOUND;
  if (!ctx.abilities.assign) return DENIED;
  if (assignedTechId && !(await listAssignableTechs()).some((t) => t.value === assignedTechId)) {
    return { fieldErrors: { assignedTechId: ["ผู้ใช้นี้ไม่สามารถรับงานซ่อมได้"] } };
  }
  if ((ctx.ticket.assignedTechId ?? undefined) === assignedTechId) return { ok: true, message: "ไม่มีการเปลี่ยนแปลง" };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { assignedTechId: assignedTechId ?? null } });
    await tx.ticketActivity.create({
      data: { ticketId, kind: "ASSIGNED", fromValue: { userId: ctx.ticket.assignedTechId }, toValue: { userId: assignedTechId ?? null }, actorId: ctx.session.user.id },
    });
    await logAction({ ...who(ctx.session), action: "ASSIGN", module: "ticket", entityId: ticketId, details: { to: assignedTechId ?? null } }, tx);
    await emitTicketEvent(tx, assignedTechId ? "TICKET_ASSIGNED" : "TICKET_UPDATED", updated, ctx.session.user.id);
  });
  if (assignedTechId) {
    queueNotify({
      event: "TICKET_ASSIGNED",
      title: `คุณได้รับมอบหมายงาน ${ctx.ticket.ticketNumber}`,
      body: ctx.ticket.title,
      href: `/tickets/${ticketId}`,
      priority: ctx.ticket.priority,
      related: { assignee: assignedTechId },
      actorId: ctx.session.user.id,
    });
  }
  return done(ticketId, assignedTechId ? "มอบหมายงานเรียบร้อยแล้ว" : "ยกเลิกการมอบหมายแล้ว");
}

export async function changePriority(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = prioritySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { ticketId, priority } = parsed.data;

  const ctx = await loadForAction(ticketId);
  if (!ctx) return NOT_FOUND;
  if (!ctx.abilities.work) return DENIED;
  if (ctx.ticket.priority === priority) return { ok: true, message: "ไม่มีการเปลี่ยนแปลง" };

  const dueAt = await dueAtFor(priority, ctx.ticket.createdAt);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { priority, dueAt } });
    await tx.ticketActivity.create({
      data: { ticketId, kind: "PRIORITY_CHANGED", fromValue: { priority: ctx.ticket.priority }, toValue: { priority }, actorId: ctx.session.user.id },
    });
    await logAction({ ...who(ctx.session), action: "PRIORITY_CHANGE", module: "ticket", entityId: ticketId, details: { from: ctx.ticket.priority, to: priority } }, tx);
    await emitTicketEvent(tx, "TICKET_UPDATED", updated, ctx.session.user.id);
  });
  return done(ticketId, "เปลี่ยนความเร่งด่วนเรียบร้อยแล้ว (คำนวณกำหนดเสร็จใหม่)");
}

export async function addComment(_prev: FormState<CommentInput>, formData: FormData): Promise<FormState<CommentInput>> {
  const parsed = commentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { ticketId, body, internal } = parsed.data;

  const ctx = await loadForAction(ticketId);
  if (!ctx) return NOT_FOUND;
  if (!ctx.abilities.comment) return DENIED;
  if (internal && !ctx.abilities.internalNotes) return DENIED;

  await prisma.$transaction(async (tx) => {
    await tx.ticketActivity.create({ data: { ticketId, kind: "COMMENT", body, internal, actorId: ctx.session.user.id } });
    if (!ctx.ticket.firstResponseAt && ctx.session.user.id !== ctx.ticket.reporterId && !internal) {
      await tx.ticket.update({ where: { id: ticketId }, data: { firstResponseAt: new Date() } });
    }
    await logAction({ ...who(ctx.session), action: "COMMENT", module: "ticket", entityId: ticketId, details: { internal } }, tx);
  });
  return done(ticketId, internal ? "บันทึกโน้ตภายในแล้ว" : "ส่งข้อความแล้ว");
}

// ---------- Repair info & parts ----------

export async function saveRepairInfo(_prev: FormState<RepairInfoInput>, formData: FormData): Promise<FormState<RepairInfoInput>> {
  const parsed = repairInfoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { ticketId, cause, resolution, laborCost } = parsed.data;

  const ctx = await loadForAction(ticketId);
  if (!ctx) return NOT_FOUND;
  if (!ctx.abilities.work) return DENIED;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: { cause: cause ?? null, resolution: resolution ?? null, laborCost: new Prisma.Decimal(laborCost ?? 0) },
    });
    await recomputeRepairCost(tx, ticketId);
    await tx.ticketActivity.create({ data: { ticketId, kind: "UPDATED", internal: true, body: "บันทึกข้อมูลการซ่อม", actorId: ctx.session.user.id } });
    await logAction({ ...who(ctx.session), action: "UPDATE_REPAIR", module: "ticket", entityId: ticketId, details: { laborCost: laborCost ?? "0" } }, tx);
  });
  return done(ticketId, "บันทึกข้อมูลการซ่อมแล้ว");
}

export async function addPart(_prev: FormState<PartInput>, formData: FormData): Promise<FormState<PartInput>> {
  const parsed = partSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { ticketId, name, qty, unitCost } = parsed.data;

  const ctx = await loadForAction(ticketId);
  if (!ctx) return NOT_FOUND;
  if (!ctx.abilities.work) return DENIED;

  await prisma.$transaction(async (tx) => {
    const part = await tx.ticketPart.create({ data: { ticketId, name, qty, unitCost: new Prisma.Decimal(unitCost) } });
    await recomputeRepairCost(tx, ticketId);
    await tx.ticketActivity.create({ data: { ticketId, kind: "PART_ADDED", internal: true, body: `${name} × ${qty}`, toValue: { partId: part.id, unitCost }, actorId: ctx.session.user.id } });
    await logAction({ ...who(ctx.session), action: "ADD_PART", module: "ticket", entityId: ticketId, details: { name, qty, unitCost } }, tx);
    await emitTicketEvent(tx, "PART_USED", ctx.ticket, ctx.session.user.id);
  });
  return done(ticketId, "เพิ่มอะไหล่แล้ว");
}

export async function removePart(partId: string): Promise<FormState> {
  const part = await prisma.ticketPart.findUnique({ where: { id: partId } });
  if (!part) return NOT_FOUND;
  const ctx = await loadForAction(part.ticketId);
  if (!ctx) return NOT_FOUND;
  if (!ctx.abilities.work) return DENIED;

  await prisma.$transaction(async (tx) => {
    await tx.ticketPart.delete({ where: { id: partId } });
    await recomputeRepairCost(tx, part.ticketId);
    await tx.ticketActivity.create({ data: { ticketId: part.ticketId, kind: "PART_REMOVED", internal: true, body: `${part.name} × ${part.qty}`, actorId: ctx.session.user.id } });
    await logAction({ ...who(ctx.session), action: "REMOVE_PART", module: "ticket", entityId: part.ticketId, details: { name: part.name } }, tx);
  });
  return done(part.ticketId, "ลบอะไหล่แล้ว");
}

// ---------- Attachments ----------

/** Upload one file (the client sends files one by one to stay under the body size limit). */
export async function uploadAttachment(formData: FormData): Promise<FormState> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "ไม่พบไฟล์" };
  if (file.size > MAX_UPLOAD_BYTES) return { message: `${file.name}: ไฟล์ใหญ่เกิน 10 MB` };

  const ctx = await loadForAction(ticketId);
  if (!ctx) return NOT_FOUND;
  if (!ctx.abilities.attach) return DENIED;

  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buffer);
  if (!type) return { message: `${file.name}: รองรับเฉพาะรูปภาพ (JPG, PNG, WEBP, GIF) และ PDF` };

  const storageKey = await saveFile(buffer, type.ext);
  try {
    await prisma.$transaction(async (tx) => {
      const att = await tx.attachment.create({
        data: { storageKey, filename: file.name.slice(0, 200), mime: type.mime, size: buffer.length, uploadedById: ctx.session.user.id, ticketId },
      });
      await tx.ticketActivity.create({ data: { ticketId, kind: "ATTACHMENT_ADDED", body: att.filename, toValue: { attachmentId: att.id }, actorId: ctx.session.user.id } });
      await logAction({ ...who(ctx.session), action: "UPLOAD", module: "ticket", entityId: ticketId, details: { attachmentId: att.id, mime: type.mime, size: buffer.length } }, tx);
    });
  } catch (e) {
    await deleteStoredFile(storageKey);
    throw e;
  }
  return done(ticketId, `อัปโหลด ${file.name} แล้ว`);
}

export async function deleteAttachment(attachmentId: string): Promise<FormState> {
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!att?.ticketId) return NOT_FOUND;
  const ctx = await loadForAction(att.ticketId);
  if (!ctx) return NOT_FOUND;
  const own = att.uploadedById === ctx.session.user.id;
  if (!(ctx.abilities.work || (own && ctx.abilities.attach))) return DENIED;

  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: attachmentId } });
    await tx.ticketActivity.create({ data: { ticketId: att.ticketId!, kind: "ATTACHMENT_REMOVED", body: att.filename, actorId: ctx.session.user.id } });
    await logAction({ ...who(ctx.session), action: "DELETE_ATTACHMENT", module: "ticket", entityId: att.ticketId, details: { attachmentId, filename: att.filename } }, tx);
  });
  await deleteStoredFile(att.storageKey);
  return done(att.ticketId, "ลบไฟล์แล้ว");
}


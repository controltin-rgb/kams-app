"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { relationTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { deleteStoredFile } from "@/lib/storage";
import { emitMoveEvent } from "@/modules/office3d/emit";
import {
  attachSchema,
  detachSchema,
  fullSwapSchema,
  partialSwapSchema,
  signSchema,
  transferSchema,
  type AttachInput,
  type DetachInput,
  type FullSwapInput,
  type PartialSwapInput,
  type SignInput,
  type TransferInput,
} from "./schemas";
import {
  activeDescendants,
  activeParentOf,
  attachSignature,
  lockedStatuses,
  nextDocNumber,
  placeAssets,
  RuleError,
  storeSignature,
  wouldCreateCycle,
} from "./service";

type Tx = Prisma.TransactionClient;
type Who = { userId: string; impersonatedBy: string | null | undefined };

async function actor(action: "create" | "update" | "swap") {
  const session = await requirePermission("deployment", action);
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };
}

/** Run a document-producing transaction: stores the optional signature first and cleans it up on failure. */
async function withDocument<T>(
  signature: { dataUrl?: string; name?: string },
  run: (tx: Tx, sign: (transferId: string) => Promise<void>) => Promise<T>,
  who: Who,
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  let file: Awaited<ReturnType<typeof storeSignature>> | null = null;
  try {
    if (signature.dataUrl) file = await storeSignature(signature.dataUrl);
    const value = await prisma.$transaction(
      (tx) =>
        run(tx, async (transferId) => {
          if (!file) return;
          await attachSignature(tx, transferId, file, who.userId);
          await tx.assetTransfer.update({ where: { id: transferId }, data: { signedByName: signature.name ?? null, signedAt: new Date() } });
        }),
      { timeout: 30_000 },
    );
    return { ok: true, value };
  } catch (e) {
    if (file) await deleteStoredFile(file.storageKey);
    if (e instanceof RuleError) return { ok: false, message: e.message };
    throw e;
  }
}

function refresh(...paths: string[]) {
  revalidatePath("/deployments");
  revalidatePath("/assets");
  for (const p of paths) revalidatePath(p);
}

async function assertRefs(refs: { ownerId?: string; departmentId?: string; locationId?: string }) {
  const [owner, dept, loc] = await Promise.all([
    refs.ownerId ? prisma.user.findFirst({ where: { id: refs.ownerId, banned: false }, select: { id: true } }) : true,
    refs.departmentId ? prisma.department.findUnique({ where: { id: refs.departmentId }, select: { id: true } }) : true,
    refs.locationId ? prisma.location.findFirst({ where: { id: refs.locationId, deletedAt: null }, select: { id: true } }) : true,
  ]);
  if (!owner) throw new RuleError("ไม่พบผู้รับมอบ");
  if (!dept) throw new RuleError("ไม่พบแผนก");
  if (!loc) throw new RuleError("ไม่พบสถานที่");
}


// ---------- Handover / return / move ----------

export async function createTransfer(_prev: FormState<TransferInput>, formData: FormData): Promise<FormState<TransferInput>> {
  const who = await actor("create");
  const parsed = transferSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const result = await withDocument(
    { dataUrl: d.signature, name: d.signedByName },
    async (tx, sign) => {
      await assertRefs({ ownerId: d.toOwnerId, departmentId: d.toDepartmentId, locationId: d.toLocationId });
      const assets = await tx.asset.findMany({ where: { id: { in: d.assetIds }, deletedAt: null }, select: { id: true, assetCode: true, status: true } });
      if (assets.length !== d.assetIds.length) throw new RuleError("มีครุภัณฑ์ที่ไม่พบหรือถูกลบแล้ว");
      for (const a of assets) {
        if (lockedStatuses.includes(a.status)) throw new RuleError(`${a.assetCode} อยู่ระหว่างซ่อม/ส่งเคลม/จำหน่ายแล้ว ย้ายไม่ได้`);
        const parent = await activeParentOf(tx, a.id);
        if (parent) throw new RuleError(`${a.assetCode} เป็นส่วนหนึ่งของชุด ${parent.parent.assetCode} — ให้ย้ายที่ตัวชุด หรือถอดออกก่อน`);
      }

      const docNumber = await nextDocNumber(tx, "HND");
      const transfer = await tx.assetTransfer.create({
        data: {
          docNumber,
          type: d.type,
          reason: d.reason ?? null,
          toOwnerId: d.type === "HANDOVER" ? d.toOwnerId : null,
          toLocationId: d.toLocationId ?? null,
          toDepartmentId: d.toDepartmentId ?? null,
          performedById: who.userId,
        },
      });
      const to =
        d.type === "HANDOVER"
          ? { ownerId: d.toOwnerId, locationId: d.toLocationId, departmentId: d.toDepartmentId, status: "IN_USE" as const }
          : d.type === "RETURN"
            ? { ownerId: null, locationId: d.toLocationId, departmentId: d.toDepartmentId, status: d.returnStatus }
            : { locationId: d.toLocationId, departmentId: d.toDepartmentId };
      const count = await placeAssets(tx, {
        rootIds: d.assetIds,
        to,
        action: d.type === "HANDOVER" ? "ASSIGN" : d.type === "RETURN" ? "RETURN" : "MOVE",
        transferId: transfer.id,
        refType: "TRANSFER",
        actorId: who.userId,
      });
      await sign(transfer.id);
      await logAction({ ...who, action: d.type, module: "deployment", entityId: transfer.id, details: { docNumber, assets: assets.map((a) => a.assetCode), count } }, tx);
      return transfer.id;
    },
    who,
  );
  if (!result.ok) return { message: result.message };
  refresh();
  return { ok: true, message: "บันทึกเอกสารเรียบร้อยแล้ว", data: { id: result.value } };
}

// ---------- Swap ----------

async function linkTicket(tx: Tx, ticketId: string | undefined, transferId: string, docNumber: string, actorId: string) {
  if (!ticketId) return null;
  const ticket = await tx.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) throw new RuleError("ไม่พบงานแจ้งซ่อมที่อ้างถึง");
  await tx.ticketActivity.create({ data: { ticketId, kind: "UPDATED", body: `เปลี่ยนเครื่อง/ชิ้นส่วน เอกสาร ${docNumber}`, toValue: { transferId }, actorId } });
  return ticket.id;
}

export async function partialSwap(_prev: FormState<PartialSwapInput>, formData: FormData): Promise<FormState<PartialSwapInput>> {
  const who = await actor("swap");
  const parsed = partialSwapSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const result = await withDocument(
    { dataUrl: d.signature, name: d.signedByName },
    async (tx, sign) => {
      await assertRefs({ locationId: d.oldLocationId });
      const rel = await tx.assetRelationship.findFirst({
        where: { parentId: d.parentId, childId: d.oldChildId, status: "ACTIVE" },
        include: { parent: true, child: { select: { assetCode: true } } },
      });
      if (!rel) throw new RuleError("ชิ้นที่เลือกไม่ได้อยู่ในชุดนี้");
      const newChild = await tx.asset.findFirst({ where: { id: d.newChildId, deletedAt: null }, select: { id: true, assetCode: true, status: true } });
      if (!newChild) throw new RuleError("ไม่พบชิ้นใหม่");
      // Rule: the replacement must be SPARE and free (CLAUDE.md §5)
      if (newChild.status !== "SPARE") throw new RuleError(`${newChild.assetCode} ต้องมีสถานะสำรอง/ในคลัง`);
      if (await activeParentOf(tx, newChild.id)) throw new RuleError(`${newChild.assetCode} อยู่ในชุดอื่นแล้ว`);
      if (await wouldCreateCycle(tx, d.parentId, newChild.id)) throw new RuleError("ไม่สามารถติดตั้งได้ (จะเกิดวงวน)");

      const docNumber = await nextDocNumber(tx, "SWP");
      const transfer = await tx.assetTransfer.create({
        data: { docNumber, type: "SWAP_PARTIAL", reason: d.reason ?? null, ticketId: d.ticketId ?? null, toLocationId: d.oldLocationId ?? null, performedById: who.userId },
      });
      await emitMoveEvent(tx, "SWAP_PARTIAL", { refId: transfer.id, docNumber, outAssetId: d.oldChildId, inAssetId: newChild.id }, who.userId);

      // 1) detach the old part → chosen status, back to stock
      await tx.assetRelationship.update({ where: { id: rel.id }, data: { status: "DETACHED", detachedAt: new Date() } });
      await placeAssets(tx, {
        rootIds: [d.oldChildId],
        to: { ownerId: null, locationId: d.oldLocationId ?? rel.parent.locationId, status: d.oldStatus },
        action: "DETACH",
        transferId: transfer.id,
        refType: "SWAP",
        actorId: who.userId,
        parentAssetId: d.parentId,
      });
      // 2) attach the new part → takes the parent's placement and status
      await tx.assetRelationship.create({ data: { parentId: d.parentId, childId: newChild.id, type: rel.type } });
      await placeAssets(tx, {
        rootIds: [newChild.id],
        to: { ownerId: rel.parent.ownerId, locationId: rel.parent.locationId, departmentId: rel.parent.departmentId, status: rel.parent.status },
        action: "ATTACH",
        transferId: transfer.id,
        refType: "SWAP",
        actorId: who.userId,
        parentAssetId: d.parentId,
      });
      await tx.assetHistory.createMany({
        data: [
          { assetId: d.parentId, event: "SWAPPED", fromValue: { childId: d.oldChildId }, toValue: { childId: newChild.id }, refType: "SWAP", refId: transfer.id, actorId: who.userId },
          { assetId: d.oldChildId, event: "DETACHED", fromValue: { parentId: d.parentId }, refType: "SWAP", refId: transfer.id, actorId: who.userId },
          { assetId: newChild.id, event: "ATTACHED", toValue: { parentId: d.parentId }, refType: "SWAP", refId: transfer.id, actorId: who.userId },
        ],
      });
      await linkTicket(tx, d.ticketId, transfer.id, docNumber, who.userId);
      await sign(transfer.id);
      await logAction(
        { ...who, action: "SWAP_PARTIAL", module: "deployment", entityId: transfer.id, details: { docNumber, parent: rel.parent.assetCode, out: rel.child.assetCode, in: newChild.assetCode } },
        tx,
      );
      return transfer.id;
    },
    who,
  );
  if (!result.ok) return { message: result.message };
  refresh(`/assets/${d.parentId}`);
  return { ok: true, message: "บันทึกการเปลี่ยนชิ้นส่วนเรียบร้อยแล้ว", data: { id: result.value } };
}

export async function fullSwap(_prev: FormState<FullSwapInput>, formData: FormData): Promise<FormState<FullSwapInput>> {
  const who = await actor("swap");
  const parsed = fullSwapSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const result = await withDocument(
    { dataUrl: d.signature, name: d.signedByName },
    async (tx, sign) => {
      await assertRefs({ locationId: d.oldLocationId });
      const [oldSet, newSet] = await Promise.all([
        tx.asset.findFirst({ where: { id: d.oldParentId, deletedAt: null } }),
        tx.asset.findFirst({ where: { id: d.newParentId, deletedAt: null } }),
      ]);
      if (!oldSet || !newSet) throw new RuleError("ไม่พบชุดอุปกรณ์");
      if (await activeParentOf(tx, oldSet.id)) throw new RuleError(`${oldSet.assetCode} เป็นชิ้นส่วนของชุดอื่น — ใช้ Partial Swap แทน`);
      if (await activeParentOf(tx, newSet.id)) throw new RuleError(`${newSet.assetCode} อยู่ในชุดอื่นแล้ว`);
      if (newSet.status !== "SPARE") throw new RuleError(`${newSet.assetCode} ต้องมีสถานะสำรอง/ในคลัง`);
      if (lockedStatuses.includes(oldSet.status) && oldSet.status !== "IN_MAINTENANCE") throw new RuleError(`${oldSet.assetCode} อยู่ในสถานะที่เปลี่ยนไม่ได้`);
      const newChildren = await activeDescendants(tx, newSet.id);
      const busy = await tx.asset.findFirst({ where: { id: { in: newChildren }, status: { not: "SPARE" } }, select: { assetCode: true } });
      if (busy) throw new RuleError(`ชิ้นส่วน ${busy.assetCode} ในชุดใหม่ไม่ได้อยู่ในสถานะสำรอง`);

      const docNumber = await nextDocNumber(tx, "SWP");
      const transfer = await tx.assetTransfer.create({
        data: {
          docNumber,
          type: "SWAP_FULL",
          reason: d.reason ?? null,
          ticketId: d.ticketId ?? null,
          toOwnerId: oldSet.ownerId,
          toLocationId: oldSet.locationId,
          toDepartmentId: oldSet.departmentId,
          performedById: who.userId,
        },
      });
      await emitMoveEvent(tx, "SWAP_FULL", { refId: transfer.id, docNumber, outAssetId: oldSet.id, inAssetId: newSet.id }, who.userId);
      // New set (with its children) takes over the holder's placement — Full Set Swap moves everything together
      await placeAssets(tx, {
        rootIds: [newSet.id],
        to: { ownerId: oldSet.ownerId, locationId: oldSet.locationId, departmentId: oldSet.departmentId, status: oldSet.ownerId ? "IN_USE" : "ACTIVE" },
        action: "ASSIGN",
        transferId: transfer.id,
        refType: "SWAP",
        actorId: who.userId,
      });
      // Old set goes back to stock
      await placeAssets(tx, {
        rootIds: [oldSet.id],
        to: { ownerId: null, locationId: d.oldLocationId, status: d.oldStatus },
        action: "RETURN",
        transferId: transfer.id,
        refType: "SWAP",
        actorId: who.userId,
      });
      await tx.assetHistory.createMany({
        data: [
          { assetId: oldSet.id, event: "SWAPPED", toValue: { replacedBy: newSet.id }, refType: "SWAP", refId: transfer.id, actorId: who.userId },
          { assetId: newSet.id, event: "SWAPPED", toValue: { replaces: oldSet.id }, refType: "SWAP", refId: transfer.id, actorId: who.userId },
        ],
      });
      await linkTicket(tx, d.ticketId, transfer.id, docNumber, who.userId);
      await sign(transfer.id);
      await logAction({ ...who, action: "SWAP_FULL", module: "deployment", entityId: transfer.id, details: { docNumber, out: oldSet.assetCode, in: newSet.assetCode } }, tx);
      return transfer.id;
    },
    who,
  );
  if (!result.ok) return { message: result.message };
  refresh();
  return { ok: true, message: "บันทึกการเปลี่ยนทั้งชุดเรียบร้อยแล้ว", data: { id: result.value } };
}

// ---------- Bundle maintenance ----------

export async function attachChild(_prev: FormState<AttachInput>, formData: FormData): Promise<FormState<AttachInput>> {
  const who = await actor("update");
  const parsed = attachSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  if (d.parentId === d.childId) return { fieldErrors: { childId: ["ติดตั้งเข้ากับตัวเองไม่ได้"] } };

  try {
    await prisma.$transaction(async (tx) => {
      const [parent, child] = await Promise.all([
        tx.asset.findFirst({ where: { id: d.parentId, deletedAt: null } }),
        tx.asset.findFirst({ where: { id: d.childId, deletedAt: null } }),
      ]);
      if (!parent || !child) throw new RuleError("ไม่พบครุภัณฑ์");
      if (lockedStatuses.includes(child.status)) throw new RuleError(`${child.assetCode} อยู่ระหว่างซ่อม/ส่งเคลม/จำหน่ายแล้ว`);
      if (await activeParentOf(tx, child.id)) throw new RuleError(`${child.assetCode} อยู่ในชุดอื่นแล้ว`);
      if (await wouldCreateCycle(tx, parent.id, child.id)) throw new RuleError("ไม่สามารถติดตั้งได้ (จะเกิดวงวน)");

      await tx.assetRelationship.create({ data: { parentId: parent.id, childId: child.id, type: d.type } });
      // Child follows the parent's placement
      const status = ["SPARE", "ACTIVE", "IN_USE"].includes(parent.status) ? parent.status : child.status;
      await tx.asset.update({ where: { id: child.id }, data: { ownerId: parent.ownerId, locationId: parent.locationId, departmentId: parent.departmentId, status } });
      await tx.assetHistory.createMany({
        data: [
          { assetId: child.id, event: "ATTACHED", toValue: { parentId: parent.id, type: d.type }, actorId: who.userId },
          ...(child.ownerId !== parent.ownerId ? [{ assetId: child.id, event: "ASSIGNED", fromValue: { ownerId: child.ownerId }, toValue: { ownerId: parent.ownerId }, actorId: who.userId }] : []),
          ...(child.locationId !== parent.locationId ? [{ assetId: child.id, event: "MOVED", fromValue: { locationId: child.locationId }, toValue: { locationId: parent.locationId }, actorId: who.userId }] : []),
          ...(child.status !== status ? [{ assetId: child.id, event: "STATUS_CHANGED", fromValue: { status: child.status }, toValue: { status }, actorId: who.userId }] : []),
        ],
      });
      await logAction({ ...who, action: "ATTACH", module: "deployment", entityId: parent.id, details: { parent: parent.assetCode, child: child.assetCode, type: d.type } }, tx);
    });
  } catch (e) {
    if (e instanceof RuleError) return { message: e.message };
    throw e;
  }
  refresh(`/assets/${d.parentId}`, `/assets/${d.childId}`);
  return { ok: true, message: `ติดตั้งเป็น${relationTypeLabels[d.type]}เรียบร้อยแล้ว` };
}

export async function detachChild(_prev: FormState<DetachInput>, formData: FormData): Promise<FormState<DetachInput>> {
  const who = await actor("update");
  const parsed = detachSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const rel = await tx.assetRelationship.findFirst({
        where: { id: d.relationshipId, status: "ACTIVE" },
        include: { parent: { select: { id: true, assetCode: true } }, child: true },
      });
      if (!rel) throw new RuleError("ไม่พบความสัมพันธ์ หรือถอดไปแล้ว");
      if (d.locationId && !(await tx.location.findFirst({ where: { id: d.locationId, deletedAt: null } }))) throw new RuleError("ไม่พบสถานที่");

      await tx.assetRelationship.update({ where: { id: rel.id }, data: { status: "DETACHED", detachedAt: new Date() } });
      const next = { ownerId: null, locationId: d.locationId ?? rel.child.locationId, status: d.status };
      await tx.asset.update({ where: { id: rel.childId }, data: next });
      await tx.assetHistory.createMany({
        data: [
          { assetId: rel.childId, event: "DETACHED", fromValue: { parentId: rel.parentId }, actorId: who.userId },
          ...(rel.child.ownerId ? [{ assetId: rel.childId, event: "ASSIGNED", fromValue: { ownerId: rel.child.ownerId }, toValue: { ownerId: null }, actorId: who.userId }] : []),
          ...(rel.child.locationId !== next.locationId ? [{ assetId: rel.childId, event: "MOVED", fromValue: { locationId: rel.child.locationId }, toValue: { locationId: next.locationId }, actorId: who.userId }] : []),
          ...(rel.child.status !== d.status ? [{ assetId: rel.childId, event: "STATUS_CHANGED", fromValue: { status: rel.child.status }, toValue: { status: d.status }, actorId: who.userId }] : []),
        ],
      });
      await logAction({ ...who, action: "DETACH", module: "deployment", entityId: rel.parentId, details: { parent: rel.parent.assetCode, child: rel.child.assetCode, status: d.status } }, tx);
    });
  } catch (e) {
    if (e instanceof RuleError) return { message: e.message };
    throw e;
  }
  refresh();
  return { ok: true, message: "ถอดออกจากชุดเรียบร้อยแล้ว" };
}

// ---------- Late signature ----------

export async function signTransfer(_prev: FormState<SignInput>, formData: FormData): Promise<FormState<SignInput>> {
  const session = await requirePermission("deployment", "view");
  const parsed = signSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  const who = { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };

  const result = await withDocument(
    { dataUrl: d.signature, name: d.signedByName },
    async (tx, sign) => {
      const transfer = await tx.assetTransfer.findUnique({ where: { id: d.transferId }, select: { id: true, docNumber: true, signedAt: true } });
      if (!transfer) throw new RuleError("ไม่พบเอกสาร");
      if (transfer.signedAt) throw new RuleError("เอกสารนี้ลงนามแล้ว");
      await sign(transfer.id);
      await logAction({ ...who, action: "SIGN", module: "deployment", entityId: transfer.id, details: { docNumber: transfer.docNumber, signedByName: d.signedByName } }, tx);
      return transfer.id;
    },
    who,
  );
  if (!result.ok) return { message: result.message };
  refresh(`/deployments/${d.transferId}`);
  return { ok: true, message: "บันทึกลายเซ็นเรียบร้อยแล้ว" };
}


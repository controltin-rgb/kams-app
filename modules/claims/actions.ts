"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { currentYear, nextSequence } from "@/lib/sequence";
import { requirePermission } from "@/lib/session";
import { emitAssetStatusEvent, emitMoveEvent } from "@/modules/office3d/emit";
import { claimUpdateSchema, createClaimSchema, type ClaimUpdateInput, type CreateClaimInput } from "./schemas";

const toDate = (v?: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

async function actor(action: "create" | "update") {
  const session = await requirePermission("claim", action);
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };
}

/** Send an asset to a vendor: asset → CLAIMING (previous status kept for the return). */
export async function createClaim(_prev: FormState<CreateClaimInput>, formData: FormData): Promise<FormState<CreateClaimInput>> {
  const who = await actor("create");
  const parsed = createClaimSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const [asset, vendor, ticket, open] = await Promise.all([
    prisma.asset.findFirst({ where: { id: d.assetId, deletedAt: null }, select: { id: true, assetCode: true, status: true } }),
    prisma.vendor.findFirst({ where: { id: d.vendorId, deletedAt: null }, select: { id: true, name: true } }),
    d.ticketId ? prisma.ticket.findUnique({ where: { id: d.ticketId }, select: { id: true } }) : null,
    prisma.externalClaim.findFirst({ where: { assetId: d.assetId, status: { in: ["SENT", "IN_REPAIR"] } }, select: { claimNumber: true } }),
  ]);
  if (!asset) return { fieldErrors: { assetId: ["ไม่พบครุภัณฑ์"] } };
  if (!vendor) return { fieldErrors: { vendorId: ["ไม่พบผู้ขาย"] } };
  if (d.ticketId && !ticket) return { fieldErrors: { ticketId: ["ไม่พบงานแจ้งซ่อม"] } };
  if (open) return { fieldErrors: { assetId: [`ครุภัณฑ์นี้อยู่ระหว่างเคลม (${open.claimNumber})`] } };
  if (asset.status === "DISPOSED" || asset.status === "CLAIMING") return { fieldErrors: { assetId: ["สถานะครุภัณฑ์ไม่สามารถส่งเคลมได้"] } };

  const id = await prisma.$transaction(async (tx) => {
    const year = currentYear();
    const claimNumber = `CLM-${year}-${String(await nextSequence(tx, "CLM", year)).padStart(4, "0")}`;
    const claim = await tx.externalClaim.create({
      data: {
        claimNumber,
        assetId: asset.id,
        vendorId: vendor.id,
        ticketId: d.ticketId ?? null,
        problem: d.problem,
        sentDate: toDate(d.sentDate)!,
        expectedReturnDate: toDate(d.expectedReturnDate),
        notes: d.notes ?? null,
        previousAssetStatus: asset.status,
        createdById: who.userId,
      },
    });
    await emitMoveEvent(tx, "CLAIM_SENT", { refId: claim.id, docNumber: claimNumber, outAssetId: asset.id, inAssetId: null }, who.userId);
    await tx.asset.update({ where: { id: asset.id }, data: { status: "CLAIMING" } });
    await emitAssetStatusEvent(tx, asset.id, "CLAIMING", who.userId);
    await tx.assetHistory.create({
      data: { assetId: asset.id, event: "STATUS_CHANGED", fromValue: { status: asset.status }, toValue: { status: "CLAIMING" }, refType: "CLAIM", refId: claim.id, actorId: who.userId },
    });
    if (d.ticketId) {
      await tx.ticketActivity.create({ data: { ticketId: d.ticketId, kind: "UPDATED", body: `ส่งเคลม ${claimNumber} ไปที่ ${vendor.name}`, toValue: { claimId: claim.id }, actorId: who.userId } });
    }
    await logAction({ ...who, action: "CREATE", module: "claim", entityId: claim.id, details: { claimNumber, asset: asset.assetCode, vendor: vendor.name } }, tx);
    return claim.id;
  });

  revalidatePath("/claims");
  revalidatePath(`/assets/${d.assetId}`);
  return { ok: true, message: "บันทึกการส่งเคลมแล้ว", data: { id } };
}

/** Progress or close a claim. Closing restores the asset's previous status; REPLACED also updates the serial. */
export async function updateClaim(_prev: FormState<ClaimUpdateInput>, formData: FormData): Promise<FormState<ClaimUpdateInput>> {
  const who = await actor("update");
  const parsed = claimUpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const claim = await prisma.externalClaim.findUnique({ where: { id: d.claimId }, include: { asset: { select: { id: true, status: true, serialNumber: true, warrantyExpiry: true } } } });
  if (!claim) return { message: "ไม่พบรายการเคลม" };
  const allowed = claim.status === "SENT" ? ["IN_REPAIR", "RETURNED", "REPLACED", "CANCELLED"] : claim.status === "IN_REPAIR" ? ["RETURNED", "REPLACED", "CANCELLED"] : [];
  if (!allowed.includes(d.status)) return { message: "สถานะปัจจุบันเปลี่ยนเป็นสถานะนี้ไม่ได้" };
  const closing = d.status !== "IN_REPAIR";

  await prisma.$transaction(async (tx) => {
    await tx.externalClaim.update({
      where: { id: claim.id },
      data: {
        status: d.status,
        actualReturnDate: closing && d.status !== "CANCELLED" ? toDate(d.actualReturnDate) : undefined,
        cost: d.cost ? new Prisma.Decimal(d.cost) : undefined,
        oldSerial: d.status === "REPLACED" ? claim.asset.serialNumber : undefined,
        newSerial: d.status === "REPLACED" ? d.newSerial : undefined,
        notes: d.note ? [claim.notes, d.note].filter(Boolean).join("\n") : undefined,
      },
    });

    if (closing) {
      if (d.status === "RETURNED" || d.status === "REPLACED") {
        await emitMoveEvent(tx, "CLAIM_RETURNED", { refId: claim.id, docNumber: claim.claimNumber, outAssetId: null, inAssetId: claim.assetId }, who.userId);
      }
      const assetData: Prisma.AssetUpdateInput = {};
      // Restore the status the asset had before the claim (unless something else changed it meanwhile)
      if (claim.asset.status === "CLAIMING") assetData.status = claim.previousAssetStatus;
      if (d.status === "REPLACED") {
        assetData.serialNumber = d.newSerial;
        if (d.newWarrantyExpiry) assetData.warrantyExpiry = toDate(d.newWarrantyExpiry);
      }
      if (Object.keys(assetData).length) await tx.asset.update({ where: { id: claim.assetId }, data: assetData });
      if (claim.asset.status === "CLAIMING") await emitAssetStatusEvent(tx, claim.assetId, claim.previousAssetStatus, who.userId);

      const history: Prisma.AssetHistoryCreateManyInput[] = [];
      if (claim.asset.status === "CLAIMING") {
        history.push({ assetId: claim.assetId, event: "STATUS_CHANGED", fromValue: { status: "CLAIMING" }, toValue: { status: claim.previousAssetStatus }, refType: "CLAIM", refId: claim.id, actorId: who.userId });
      }
      if (d.status === "REPLACED") {
        history.push({
          assetId: claim.assetId,
          event: "SERIAL_REPLACED",
          fromValue: { serialNumber: claim.asset.serialNumber, warrantyExpiry: claim.asset.warrantyExpiry?.toISOString().slice(0, 10) ?? null },
          toValue: { serialNumber: d.newSerial, warrantyExpiry: d.newWarrantyExpiry ?? null },
          refType: "CLAIM",
          refId: claim.id,
          actorId: who.userId,
        });
      }
      if (history.length) await tx.assetHistory.createMany({ data: history });
      if (claim.ticketId) {
        await tx.ticketActivity.create({ data: { ticketId: claim.ticketId, kind: "UPDATED", body: `เคลม ${claim.claimNumber}: ${d.status === "RETURNED" ? "รับคืนแล้ว" : d.status === "REPLACED" ? `เปลี่ยนเครื่องใหม่ (S/N ${d.newSerial})` : "ยกเลิก"}`, actorId: who.userId } });
      }
    }
    await logAction({ ...who, action: `STATUS_${d.status}`, module: "claim", entityId: claim.id, details: { claimNumber: claim.claimNumber, from: claim.status, to: d.status, newSerial: d.newSerial } }, tx);
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claim.id}`);
  revalidatePath(`/assets/${claim.assetId}`);
  return { ok: true, message: "อัปเดตสถานะเคลมแล้ว" };
}

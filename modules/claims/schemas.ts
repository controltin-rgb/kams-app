import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
const money = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "จำนวนเงินไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)");

export const createClaimSchema = z
  .object({
    assetId: z.string({ error: "กรุณาเลือกครุภัณฑ์" }).min(1, "กรุณาเลือกครุภัณฑ์"),
    vendorId: z.string({ error: "กรุณาเลือกผู้ขาย/ศูนย์บริการ" }).min(1, "กรุณาเลือกผู้ขาย/ศูนย์บริการ"),
    ticketId: z.string().optional(),
    problem: z.string({ error: "กรุณาระบุอาการ/ปัญหา" }).min(3, "กรุณาระบุอาการ/ปัญหา").max(2000),
    sentDate: isoDate,
    expectedReturnDate: isoDate.optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => !d.expectedReturnDate || d.expectedReturnDate >= d.sentDate, { path: ["expectedReturnDate"], message: "ต้องไม่ก่อนวันที่ส่ง" });

export const claimUpdateSchema = z
  .object({
    claimId: z.string().min(1),
    status: z.enum(["IN_REPAIR", "RETURNED", "REPLACED", "CANCELLED"]),
    actualReturnDate: isoDate.optional(),
    cost: money.optional(),
    newSerial: z.string().max(100).optional(),
    newWarrantyExpiry: isoDate.optional(),
    note: z.string().max(2000).optional(),
  })
  .refine((d) => !["RETURNED", "REPLACED"].includes(d.status) || !!d.actualReturnDate, { path: ["actualReturnDate"], message: "กรุณาระบุวันที่รับคืน" })
  .refine((d) => d.status !== "REPLACED" || !!d.newSerial, { path: ["newSerial"], message: "กรุณาระบุ Serial ของเครื่องใหม่" })
  .refine((d) => d.status !== "CANCELLED" || !!d.note, { path: ["note"], message: "กรุณาระบุเหตุผล" });

export type CreateClaimInput = z.input<typeof createClaimSchema>;
export type ClaimUpdateInput = z.input<typeof claimUpdateSchema>;

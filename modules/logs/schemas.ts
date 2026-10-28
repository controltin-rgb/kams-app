import { z } from "zod";

export const CLEAR_CONFIRM_TEXT = "ล้าง Log";

export const clearLogSchema = z.object({
  olderThanDays: z.enum(["0", "30", "90", "180", "365"], { error: "กรุณาเลือกช่วงเวลา" }),
  confirm: z.string({ error: `พิมพ์ "${CLEAR_CONFIRM_TEXT}" เพื่อยืนยัน` }).refine((v) => v === CLEAR_CONFIRM_TEXT, `พิมพ์ "${CLEAR_CONFIRM_TEXT}" เพื่อยืนยัน`),
});
export type ClearLogInput = z.input<typeof clearLogSchema>;

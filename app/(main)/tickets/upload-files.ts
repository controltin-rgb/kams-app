"use client";

import { toast } from "sonner";
import { uploadAttachment } from "@/modules/tickets/actions";

export const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const MAX = 10 * 1024 * 1024;

/** Upload files one by one (each request stays under the server action body limit). Returns how many succeeded. */
export async function uploadFiles(ticketId: string, files: File[]) {
  let ok = 0;
  for (const file of files) {
    if (file.size > MAX) {
      toast.error(`${file.name}: ไฟล์ใหญ่เกิน 10 MB`);
      continue;
    }
    const fd = new FormData();
    fd.set("ticketId", ticketId);
    fd.set("file", file);
    const result = await uploadAttachment(fd);
    if (result.ok) ok++;
    else toast.error(result.message ?? `${file.name}: อัปโหลดไม่สำเร็จ`);
  }
  return ok;
}

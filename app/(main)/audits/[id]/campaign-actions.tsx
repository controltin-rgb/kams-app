"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Lock, Pencil, Play, ScanLine, Square, Trash2, X } from "lucide-react";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Button } from "@/components/ui/button";
import type { CampaignStatus } from "@/generated/prisma/enums";
import { closeCampaign, completeCampaign, deleteCampaign, reconcileAll, startCampaign } from "@/modules/audits/actions";

export function CampaignActions({
  id,
  status,
  pending,
  canScan,
  canManage,
  canApprove,
  canDelete,
}: {
  id: string;
  status: CampaignStatus;
  pending: number;
  canScan: boolean;
  canManage: boolean;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const btn = "h-10 rounded-xl";

  return (
    <div className="flex flex-wrap gap-2">
      {status === "IN_PROGRESS" && canScan && (
        <Button asChild variant="gradient" className={btn}>
          {/* Full page load so the service worker can cache the scan page for offline use */}
          <a href={`/audits/${id}/scan`}>
            <ScanLine /> สแกนตรวจนับ
          </a>
        </Button>
      )}
      {canManage && status !== "CLOSED" && (
        <Button asChild variant="outline" className={btn}>
          <Link href={`/audits/${id}/edit`}>
            <Pencil /> แก้ไข
          </Link>
        </Button>
      )}
      {canManage && status === "DRAFT" && (
        <ConfirmAction
          title="เริ่มตรวจนับ?"
          description="ผู้ตรวจนับจะเริ่มสแกนได้ และขอบเขตสถานที่จะแก้ไขไม่ได้อีก"
          confirmLabel="เริ่มตรวจนับ"
          variant="gradient"
          onConfirm={() => startCampaign(id)}
          trigger={
            <Button variant="gradient" className={btn}>
              <Play /> เริ่มตรวจนับ
            </Button>
          }
        />
      )}
      {canDelete && status === "DRAFT" && (
        <ConfirmAction
          title="ลบรอบตรวจนับนี้?"
          onConfirm={() => deleteCampaign(id)}
          onSuccess={() => router.push("/audits")}
          trigger={
            <Button variant="outline" className={`${btn} text-destructive`}>
              <Trash2 /> ลบ
            </Button>
          }
        />
      )}
      {canManage && status === "IN_PROGRESS" && (
        <ConfirmAction
          title="ปิดการสแกน?"
          description="ครุภัณฑ์ในขอบเขตที่ยังไม่ถูกสแกนจะถูกบันทึกเป็น &quot;ไม่พบ&quot; ให้ผู้ตรวจนับซิงก์ข้อมูลที่ค้างในเครื่องก่อน"
          confirmLabel="ปิดการสแกน"
          onConfirm={() => completeCampaign(id)}
          trigger={
            <Button variant="outline" className={btn}>
              <Square /> ปิดการสแกน
            </Button>
          }
        />
      )}
      {canApprove && status === "COMPLETED" && pending > 0 && (
        <>
          <ConfirmAction
            title={`อนุมัติปรับปรุงทะเบียนทั้งหมด ${pending} รายการ?`}
            description="พบต่างสถานที่ → ย้ายสถานที่, ไม่พบ → สถานะรอจำหน่าย, สภาพเปลี่ยน → ปรับสภาพ (บันทึกประวัติทุกรายการ)"
            confirmLabel="อนุมัติทั้งหมด"
            variant="gradient"
            onConfirm={() => reconcileAll(id, "APPLY")}
            trigger={
              <Button variant="gradient" className={btn}>
                <CheckCheck /> อนุมัติทั้งหมด
              </Button>
            }
          />
          <ConfirmAction
            title={`ข้ามทั้งหมด ${pending} รายการ?`}
            description="ไม่ปรับปรุงข้อมูลทะเบียนสำหรับรายการที่เหลือ"
            confirmLabel="ข้ามทั้งหมด"
            variant="default"
            onConfirm={() => reconcileAll(id, "IGNORE")}
            trigger={
              <Button variant="outline" className={btn}>
                <X /> ข้ามทั้งหมด
              </Button>
            }
          />
        </>
      )}
      {canApprove && status === "COMPLETED" && pending === 0 && (
        <ConfirmAction
          title="ปิดรอบตรวจนับ?"
          description="ปิดแล้วจะแก้ไขผลไม่ได้อีก"
          confirmLabel="ปิดรอบ"
          variant="gradient"
          onConfirm={() => closeCampaign(id)}
          trigger={
            <Button variant="gradient" className={btn}>
              <Lock /> ปิดรอบ
            </Button>
          }
        />
      )}
    </div>
  );
}

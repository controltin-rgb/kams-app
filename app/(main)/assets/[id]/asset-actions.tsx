"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Button } from "@/components/ui/button";
import { deleteAsset } from "@/modules/assets/actions";

export function AssetActions({ id, assetCode, canUpdate, canDelete }: { id: string; assetCode: string; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  return (
    <>
      {canUpdate && (
        <Button asChild variant="outline" className="h-10 rounded-xl">
          <Link href={`/assets/${id}/edit`}>
            <Pencil /> แก้ไข
          </Link>
        </Button>
      )}
      {canDelete && (
        <ConfirmAction
          title={`ลบครุภัณฑ์ ${assetCode}?`}
          description="ครุภัณฑ์จะถูกซ่อนจากทะเบียน (soft delete) ประวัติทั้งหมดยังคงเก็บไว้"
          onConfirm={() => deleteAsset(id)}
          onSuccess={() => router.push("/assets")}
          trigger={
            <Button variant="destructive" className="h-10 rounded-xl">
              <Trash2 /> ลบ
            </Button>
          }
        />
      )}
    </>
  );
}

/** Shows a toast after redirecting from create/edit (?created=1 / ?updated=1), then cleans the URL. */
export function SavedToast() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const message = params.get("created") ? "ลงทะเบียนครุภัณฑ์เรียบร้อยแล้ว" : params.get("updated") ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : null;
    if (!message) return;
    toast.success(message);
    router.replace(window.location.pathname, { scroll: false });
  }, [params, router]);
  return null;
}

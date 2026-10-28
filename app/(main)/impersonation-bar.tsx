"use client";

import { useState } from "react";
import { Loader2, VenetianMask } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Always-visible warning while an admin is acting as another user (CLAUDE.md §6). */
export function ImpersonationBar({ userName, impersonator }: { userName: string; impersonator: string }) {
  const [pending, setPending] = useState(false);

  const stop = async () => {
    setPending(true);
    const { error } = await authClient.admin.stopImpersonating();
    if (error) {
      setPending(false);
      toast.error(error.message ?? "ไม่สามารถออกจากโหมดเข้าใช้งานแทนได้");
      return;
    }
    // Full reload: the whole app must re-render with the admin's own session
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops routes cached with the previous session
    window.location.href = "/admin/users";
  };

  return (
    <div role="alert" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-amber-500 px-4 py-2 text-sm font-medium text-black print:hidden">
      <span className="flex items-center gap-2">
        <VenetianMask className="size-4 shrink-0" />
        กำลังใช้งานในฐานะ <b>{userName}</b> (โดย {impersonator}) — ทุกการกระทำถูกบันทึก
      </span>
      <Button size="sm" variant="outline" className="h-8 rounded-lg border-black/30 bg-white/80 text-black hover:bg-white" onClick={stop} disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} กลับเป็นผู้ดูแลระบบ
      </Button>
    </div>
  );
}

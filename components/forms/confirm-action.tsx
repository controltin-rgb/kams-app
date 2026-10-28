"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { FormState } from "@/lib/form-state";

/** Confirmation dialog for destructive server actions (delete, etc.). Shows the result as a toast. */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "ลบ",
  variant = "destructive",
  onConfirm,
  onSuccess,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: "destructive" | "default" | "gradient";
  onConfirm: () => Promise<FormState>;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="rounded-xl">
            ยกเลิก
          </AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={pending}
            className="rounded-xl"
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await onConfirm();
                if (result.ok) {
                  toast.success(result.message ?? "ดำเนินการเรียบร้อย");
                  setOpen(false);
                  onSuccess?.();
                } else {
                  toast.error(result.message ?? "ไม่สามารถดำเนินการได้");
                }
              });
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

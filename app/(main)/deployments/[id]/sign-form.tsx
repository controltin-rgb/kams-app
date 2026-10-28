"use client";

import { toast } from "sonner";
import { Field, FormMessage, SubmitButton } from "@/components/forms/field";
import { SignaturePad } from "@/components/forms/signature-pad";
import { useFormAction } from "@/components/forms/use-form-action";
import { signTransfer } from "@/modules/deployments/actions";

export function SignForm({ transferId, defaultName }: { transferId: string; defaultName?: string | null }) {
  const { state, onSubmit, pending } = useFormAction(signTransfer, (s) => toast.success(s.message));
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="transferId" value={transferId} />
      <SignaturePad />
      <Field label="ชื่อผู้ลงนาม" name="signedByName" required defaultValue={defaultName ?? undefined} errors={state.fieldErrors?.signedByName} />
      {state.fieldErrors?.signature && <p className="text-sm text-destructive">กรุณาลงนามในช่องด้านบน</p>}
      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <div className="flex justify-end">
        <SubmitButton pending={pending}>บันทึกลายเซ็น</SubmitButton>
      </div>
    </form>
  );
}

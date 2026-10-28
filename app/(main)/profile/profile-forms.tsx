"use client";

import { useEffect, useRef } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { changePassword, updateProfile } from "@/modules/profile/actions";

export function ProfileForm({ name, email, lineUserId }: { name: string; email: string; lineUserId: string | null }) {
  const { state, onSubmit, pending } = useFormAction(updateProfile);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ชื่อ-นามสกุล" name="name" defaultValue={name} autoComplete="name" required errors={state.fieldErrors?.name} />
        <Field label="อีเมล" name="email" type="email" defaultValue={email} autoComplete="email" required errors={state.fieldErrors?.email} />
        <Field
          label="LINE User ID"
          name="lineUserId"
          defaultValue={lineUserId ?? ""}
          autoComplete="off"
          placeholder="U0123456789abcdef0123456789abcdef"
          hint="สำหรับรับการแจ้งเตือนทาง LINE (ดูได้จาก LINE Official Account ของหน่วยงาน) เว้นว่างถ้าไม่ต้องการ"
          errors={state.fieldErrors?.lineUserId}
        />
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>บันทึกข้อมูล</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { state, onSubmit, pending } = useFormAction(changePassword);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <Field
        label="รหัสผ่านปัจจุบัน"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.currentPassword}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="รหัสผ่านใหม่"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="อย่างน้อย 8 ตัวอักษร"
          errors={state.fieldErrors?.newPassword}
        />
        <Field
          label="ยืนยันรหัสผ่านใหม่"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          errors={state.fieldErrors?.confirmPassword}
        />
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>เปลี่ยนรหัสผ่าน</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormState } from "@/lib/form-state";
import { FormMessage, SubmitButton } from "./field";
import { useFormAction } from "./use-form-action";

type FormAction<T> = (prev: FormState<T>, formData: FormData) => Promise<FormState<T>>;

type FormDialogProps<T> = {
  title: string;
  description?: string;
  trigger: ReactNode;
  action: FormAction<T>;
  submitLabel?: string;
  /** Hidden fields, e.g. the id of the record being edited */
  hidden?: Record<string, string>;
  children: (state: FormState<T>) => ReactNode;
  className?: string;
  onSuccess?: (state: FormState<T>) => void;
};

function DialogForm<T>({
  action,
  hidden,
  submitLabel,
  children,
  onDone,
}: Pick<FormDialogProps<T>, "action" | "hidden" | "submitLabel" | "children"> & { onDone: (state: FormState<T>) => void }) {
  const { state, onSubmit, pending } = useFormAction(action, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children(state)}
      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <DialogFooter className="gap-2 pt-2">
        <SubmitButton pending={pending}>{submitLabel ?? "บันทึก"}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

/** Dialog wrapping a server-action form. The form state resets every time the dialog opens. */
export function FormDialog<T>({ title, description, trigger, className = "sm:max-w-lg", onSuccess, ...form }: FormDialogProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={`max-h-[90dvh] overflow-y-auto rounded-3xl p-6 ${className}`}>
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {open && (
          <DialogForm
            {...form}
            onDone={(state) => {
              setOpen(false);
              if (state.message) toast.success(state.message);
              onSuccess?.(state);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AddButton({ children = "เพิ่ม", ...props }: ComponentProps<typeof Button>) {
  return (
    <Button variant="gradient" className="h-10 rounded-xl px-4" {...props}>
      {children}
    </Button>
  );
}

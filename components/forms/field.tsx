import { useId, type ComponentProps, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NONE } from "@/lib/form-state";

export const inputClass = "h-12 rounded-xl bg-muted/50 px-4 focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-ring/15";

function FieldLabel({ htmlFor, label, required }: { htmlFor: string; label: string; required?: boolean }) {
  return (
    <Label htmlFor={htmlFor} className="font-semibold">
      {label}
      {required && <span className="text-destructive">*</span>}
    </Label>
  );
}

function FieldHint({ id, errors, hint }: { id?: string; errors?: string[]; hint?: string }) {
  if (id) {
    return (
      <p id={id} className="text-sm text-destructive">
        {errors?.[0]}
      </p>
    );
  }
  return hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null;
}

type FieldProps = ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
};

export function Field({ label, name, errors, hint, className = "", id, ...props }: FieldProps) {
  // Unique per instance: hidden (cached) routes stay in the DOM, so ids must not repeat across pages
  const autoId = useId();
  const inputId = id ?? `${name}-${autoId}`;
  const errorId = errors?.length ? `${inputId}-error` : undefined;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <FieldLabel htmlFor={inputId} label={label} required={props.required} />
      <Input id={inputId} name={name} aria-invalid={!!errorId} aria-describedby={errorId} className={inputClass} {...props} />
      <FieldHint id={errorId} errors={errors} hint={hint} />
    </div>
  );
}

type Option = { value: string; label: string };

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  placeholder = "เลือก...",
  allowEmpty,
  emptyLabel = "- ไม่ระบุ -",
  errors,
  hint,
  required,
  disabled,
  onValueChange,
  className = "",
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValue?: string | null;
  placeholder?: string;
  /** Adds a "not set" option (submitted as empty) */
  allowEmpty?: boolean;
  emptyLabel?: string;
  errors?: string[];
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  const inputId = `${name}-${useId()}`;
  const errorId = errors?.length ? `${inputId}-error` : undefined;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <FieldLabel htmlFor={inputId} label={label} required={required} />
      <Select
        name={name}
        defaultValue={defaultValue ?? (allowEmpty ? NONE : undefined)}
        required={required}
        disabled={disabled}
        onValueChange={onValueChange}
      >
        <SelectTrigger id={inputId} aria-invalid={!!errorId} aria-describedby={errorId} className="h-12! w-full rounded-xl bg-muted/50 px-4">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72 rounded-xl">
          {allowEmpty && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldHint id={errorId} errors={errors} hint={hint} />
    </div>
  );
}

export function TextareaField({
  label,
  name,
  errors,
  hint,
  className = "",
  ...props
}: ComponentProps<typeof Textarea> & { label: string; name: string; errors?: string[]; hint?: string }) {
  const inputId = `${name}-${useId()}`;
  const errorId = errors?.length ? `${inputId}-error` : undefined;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <FieldLabel htmlFor={inputId} label={label} required={props.required} />
      <Textarea
        id={inputId}
        name={name}
        aria-invalid={!!errorId}
        aria-describedby={errorId}
        className="min-h-24 rounded-xl bg-muted/50 px-4 py-3 focus-visible:bg-card"
        {...props}
      />
      <FieldHint id={errorId} errors={errors} hint={hint} />
    </div>
  );
}

export function CheckboxField({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  const inputId = `${name}-${useId()}`;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <Checkbox id={inputId} name={name} value="true" defaultChecked={defaultChecked} className="mt-0.5" />
      <div>
        <Label htmlFor={inputId} className="font-semibold">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`animate-drop rounded-xl px-4 py-3 text-sm ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"}`}
    >
      {message}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" variant="gradient" disabled={pending} className="h-11 rounded-xl px-6">
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "กำลังบันทึก..." : children}
    </Button>
  );
}

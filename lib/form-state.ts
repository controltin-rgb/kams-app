import type { z } from "zod";

/** Radix Select cannot use "" as a value; use this for "no selection" options. */
export const NONE = "__none__";

/** Shared result shape for form server actions (used with useActionState). */
export type FormState<T = Record<string, unknown>> = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof T, string[]>>;
  /** Optional payload, e.g. the id of a created record */
  data?: { id?: string };
};

export function fieldErrors<T>(error: z.ZodError<T>): FormState<T> {
  const fe: Partial<Record<keyof T, string[]>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof T | undefined;
    if (key === undefined) continue;
    (fe[key] ??= []).push(issue.message);
  }
  return { fieldErrors: fe, message: "กรุณาตรวจสอบข้อมูลที่กรอก" };
}

/**
 * Convert FormData to a plain object. Empty strings and the Select "none" sentinel become undefined
 * so optional fields validate cleanly. Repeated keys keep the last value.
 */
export function formDataToObject(formData: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? value.trim() : undefined;
    out[key] = v === "" || v === NONE ? undefined : v;
  }
  return out;
}

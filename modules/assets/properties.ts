import type { PropertyType } from "@/generated/prisma/client";

export type PropertyDefLike = {
  key: string;
  label: string;
  type: PropertyType;
  required: boolean;
  options: string[];
};

const TRUE = new Set(["true", "1", "yes", "y", "ใช่", "on"]);
const FALSE = new Set(["false", "0", "no", "n", "ไม่", "ไม่ใช่", "off"]);

/**
 * Validate and normalise property values against the category's definitions.
 * Unknown keys are ignored; empty optional values are dropped.
 */
export function validateProperties(defs: PropertyDefLike[], raw: Record<string, string | undefined>) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const def of defs) {
    const input = raw[def.key]?.trim() ?? "";

    if (def.type === "BOOLEAN") {
      const v = input.toLowerCase();
      if (!v) {
        if (def.required) errors[def.key] = `กรุณาระบุ${def.label}`;
        continue;
      }
      if (TRUE.has(v)) values[def.key] = "true";
      else if (FALSE.has(v)) values[def.key] = "false";
      else errors[def.key] = `${def.label}: ใช้ ใช่/ไม่ใช่`;
      continue;
    }

    if (!input) {
      if (def.required) errors[def.key] = `กรุณากรอก${def.label}`;
      continue;
    }

    switch (def.type) {
      case "NUMBER":
        if (!/^-?\d+(\.\d+)?$/.test(input)) errors[def.key] = `${def.label} ต้องเป็นตัวเลข`;
        else values[def.key] = input;
        break;
      case "DATE":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(Date.parse(input))) errors[def.key] = `${def.label}: รูปแบบวันที่ YYYY-MM-DD`;
        else values[def.key] = input;
        break;
      case "SELECT":
        if (!def.options.includes(input)) errors[def.key] = `${def.label} ต้องเป็นหนึ่งใน: ${def.options.join(", ")}`;
        else values[def.key] = input;
        break;
      default:
        if (input.length > 500) errors[def.key] = `${def.label} ยาวเกิน 500 ตัวอักษร`;
        else values[def.key] = input;
    }
  }

  return { values, errors };
}

/** Human-readable value for display/export */
export function formatPropertyValue(type: PropertyType, value: string | undefined): string {
  if (value === undefined || value === "") return "-";
  if (type === "BOOLEAN") return value === "true" ? "ใช่" : "ไม่ใช่";
  return value;
}

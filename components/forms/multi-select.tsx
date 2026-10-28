"use client";

import { useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { value: string; label: string };

/** Searchable checklist. Submits the selected values comma-separated in a hidden input. */
export function MultiSelect({
  label,
  name,
  options,
  defaultValues = [],
  errors,
  required,
  placeholder = "ค้นหา...",
  onChange,
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValues?: string[];
  errors?: string[];
  required?: boolean;
  placeholder?: string;
  onChange?: (values: string[]) => void;
}) {
  const uid = useId();
  const [selected, setSelected] = useState<string[]>(defaultValues);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, 200);
  }, [options, query]);
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    setSelected(next);
    onChange?.(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">
        {label}
        {required && <span className="text-destructive">*</span>} <span className="font-normal text-muted-foreground">(เลือกแล้ว {selected.length})</span>
      </p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              {options.find((o) => o.value === v)?.label.split(" ")[0] ?? v}
              <button type="button" aria-label="เอาออก" onClick={() => toggle(v)} className="hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={`ค้นหา${label}`} className="h-11 rounded-xl pl-9" />
      </div>
      <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border" role="listbox" aria-multiselectable>
        {filtered.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">ไม่พบรายการ</li>}
        {filtered.map((o) => {
          const id = `${uid}-${o.value}`;
          return (
            <li key={o.value} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
              <Checkbox id={id} checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
                {o.label}
              </Label>
            </li>
          );
        })}
      </ul>
      <input type="hidden" name={name} value={selected.join(",")} />
      {errors?.[0] && <p className="text-sm text-destructive">{errors[0]}</p>}
    </div>
  );
}

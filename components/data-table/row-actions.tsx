"use client";

import type { ComponentProps } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditIconButton(props: ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="แก้ไข" className="rounded-lg text-muted-foreground hover:text-primary" {...props}>
      <Pencil />
    </Button>
  );
}

export function DeleteIconButton(props: ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="ลบ" className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" {...props}>
      <Trash2 />
    </Button>
  );
}

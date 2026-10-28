"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden">
      <Button variant="gradient" className="h-10 rounded-xl px-4" onClick={() => window.print()}>
        <Printer /> พิมพ์ / บันทึกเป็น PDF
      </Button>
    </div>
  );
}

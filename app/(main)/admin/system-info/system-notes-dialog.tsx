"use client";

import { Pencil } from "lucide-react";
import { TextareaField } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { saveSystemInfo } from "@/modules/settings/actions";

export function SystemNotesDialog({ releaseNotes, roadmap }: { releaseNotes: string; roadmap: string }) {
  return (
    <FormDialog
      title="แก้ไข Release notes / Roadmap"
      className="sm:max-w-2xl"
      trigger={
        <Button variant="outline" className="h-10 rounded-xl">
          <Pencil /> แก้ไขบันทึก
        </Button>
      }
      action={saveSystemInfo}
    >
      {(state) => (
        <>
          <TextareaField label="บันทึกการเปลี่ยนแปลง (Release notes)" name="releaseNotes" rows={8} defaultValue={releaseNotes} errors={state.fieldErrors?.releaseNotes} />
          <TextareaField label="แผนการพัฒนา (Roadmap)" name="roadmap" rows={8} defaultValue={roadmap} errors={state.fieldErrors?.roadmap} />
        </>
      )}
    </FormDialog>
  );
}

"use client";

import { useId, useTransition } from "react";
import { BellRing, Send } from "lucide-react";
import { toast } from "sonner";
import { FormMessage, SubmitButton } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ticketPriorityLabels } from "@/lib/labels";
import { saveNotificationSettings, sendTestNotification } from "@/modules/notifications/actions";
import { channelLabels, channels, notifyEventKeys, notifyEvents, recipientLabels, type Channel, type EventConfig, type NotifyEvent } from "@/modules/notifications/events";

function Check({ name, label, defaultChecked, disabled }: { name: string; label: string; defaultChecked: boolean; disabled?: boolean }) {
  const id = `${name}-${useId()}`;
  return (
    <span className="inline-flex items-center gap-2">
      <Checkbox id={id} name={name} value="true" defaultChecked={defaultChecked} disabled={disabled} />
      <Label htmlFor={id} className={`font-normal ${disabled ? "text-muted-foreground" : ""}`}>
        {label}
      </Label>
    </span>
  );
}

function TestButton({ channel, disabled }: { channel: Channel; disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="rounded-lg"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const r = await sendTestNotification(channel);
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        })
      }
    >
      <Send /> ทดสอบ
    </Button>
  );
}

const readyHint: Record<Channel, string> = {
  inApp: "แสดงที่กระดิ่งด้านบน",
  email: "ตั้งค่า SMTP แล้ว — ส่งไปที่อีเมลของผู้ใช้",
  line: "ตั้งค่าแล้ว — ผู้ใช้ต้องกรอก LINE User ID ในหน้าโปรไฟล์",
};
const setupHint: Record<Channel, string> = {
  inApp: "",
  email: "ยังไม่ได้ตั้งค่า: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM ใน .env",
  line: "ยังไม่ได้ตั้งค่า: LINE_CHANNEL_ACCESS_TOKEN (LINE Messaging API) ใน .env",
};

export function NotificationSettingsForm({
  globalChannels,
  events,
  ready,
}: {
  globalChannels: Record<Channel, boolean>;
  events: Record<NotifyEvent, EventConfig>;
  ready: Record<Channel, boolean>;
}) {
  const { state, onSubmit, pending } = useFormAction(saveNotificationSettings, (s) => toast.success(s.message));

  return (
    <form onSubmit={onSubmit} className="animate-fade-up space-y-5 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
      <div>
        <h2 className="mb-1 flex items-center gap-2.5 text-lg font-semibold">
          <BellRing className="size-5 text-primary" /> การแจ้งเตือน
        </h2>
        <p className="text-sm text-muted-foreground">เลือกช่องทาง แล้วกำหนดว่าเหตุการณ์ใดแจ้งใคร ผ่านช่องทางไหน งานเตือนตามเวลา (SLA/PM/เคลม/ประกัน) ทำงานเมื่อ scheduler เรียก /api/cron/notify</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">ช่องทาง</legend>
        {channels.map((c) => (
          <div key={c} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="min-w-0">
              <Check name={`channel.${c}`} label={channelLabels[c]} defaultChecked={globalChannels[c]} disabled={!ready[c]} />
              <p className="mt-1 text-xs text-muted-foreground">{ready[c] ? readyHint[c] : setupHint[c]}</p>
            </div>
            <TestButton channel={c} disabled={!ready[c]} />
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">เหตุการณ์และเงื่อนไข</legend>
        {notifyEventKeys.map((key) => {
          const def = notifyEvents[key];
          const cfg = events[key];
          const condition = "condition" in def ? def.condition : undefined;
          return (
            <div key={key} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Check name={`ev.${key}.enabled`} label={def.label} defaultChecked={cfg.enabled} />
                  <p className="ml-6 text-xs text-muted-foreground">
                    {def.description}
                    {"scheduled" in def && " · ตามรอบเวลา"}
                  </p>
                </div>
                {condition === "minPriority" && (
                  <label className="flex items-center gap-2 text-sm">
                    ความเร่งด่วนตั้งแต่
                    <Select name={`ev.${key}.minPriority`} defaultValue={cfg.minPriority ?? "LOW"}>
                      <SelectTrigger className="h-9 w-32 rounded-lg" aria-label={`${def.label}: ความเร่งด่วนขั้นต่ำ`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
                          <SelectItem key={p} value={p}>
                            {ticketPriorityLabels[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}
                {condition === "daysBefore" && (
                  <label className="flex items-center gap-2 text-sm">
                    ล่วงหน้า
                    <Input
                      type="number"
                      name={`ev.${key}.daysBefore`}
                      min={0}
                      max={365}
                      defaultValue={cfg.daysBefore}
                      className="h-9 w-20 rounded-lg"
                      aria-label={`${def.label}: จำนวนวันล่วงหน้า`}
                    />
                    วัน
                  </label>
                )}
              </div>
              <div className="ml-6 grid gap-2 text-sm sm:grid-cols-[6rem_1fr]">
                <span className="text-muted-foreground">ช่องทาง</span>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {channels.map((c) => (
                    <Check key={c} name={`ev.${key}.ch.${c}`} label={channelLabels[c]} defaultChecked={cfg.channels.includes(c)} />
                  ))}
                </div>
                <span className="text-muted-foreground">ผู้รับ</span>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {def.recipients.map((g) => (
                    <Check key={g} name={`ev.${key}.to.${g}`} label={recipientLabels[g]} defaultChecked={cfg.recipients.includes(g)} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </fieldset>

      {!state.ok && <FormMessage message={state.message} />}
      <div className="flex justify-end">
        <SubmitButton pending={pending}>บันทึกการแจ้งเตือน</SubmitButton>
      </div>
    </form>
  );
}

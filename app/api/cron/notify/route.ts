import { logAction } from "@/lib/audit";
import { cronUnauthorized } from "@/lib/cron-auth";
import { runReminders } from "@/modules/notifications/reminders";

/**
 * Scheduled notifications (SLA, PM, claims, warranty). Run hourly from an external scheduler:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notify
 * Each reminder is sent once (dedupe keys), so frequent runs are safe.
 */
export async function GET(request: Request) {
  const denied = cronUnauthorized(request);
  if (denied) return denied;

  const sent = await runReminders();
  if (Object.keys(sent).length) await logAction({ action: "CRON_NOTIFY", module: "notification", details: sent });
  return Response.json({ ok: true, sent });
}

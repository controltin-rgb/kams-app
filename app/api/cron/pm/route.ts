import { logAction } from "@/lib/audit";
import { cronUnauthorized } from "@/lib/cron-auth";
import { generatePmRuns } from "@/modules/pm/service";

/**
 * Daily PM generation for an external scheduler (cron / Windows Task Scheduler):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/pm
 * Safe to call repeatedly — generation is idempotent.
 */
export async function GET(request: Request) {
  const denied = cronUnauthorized(request);
  if (denied) return denied;

  const result = await generatePmRuns();
  await logAction({ action: "CRON_GENERATE", module: "pm", details: result });
  return Response.json({ ok: true, ...result });
}

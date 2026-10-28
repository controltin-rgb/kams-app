import { logAction } from "@/lib/audit";
import { cronUnauthorized } from "@/lib/cron-auth";
import { getSettings } from "@/lib/settings";
import { createBackup, listBackups, pruneBackups } from "@/modules/backup/service";
import { notify } from "@/modules/notifications/service";

/**
 * Daily backup for an external scheduler (cron / Windows Task Scheduler):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/backup
 * Skips when disabled in settings or when an automatic backup was already made in the last 20 hours,
 * so calling it more often than daily is harmless.
 */
export async function GET(request: Request) {
  const denied = cronUnauthorized(request);
  if (denied) return denied;

  const settings = await getSettings();
  if (!settings["backup.autoEnabled"]) return Response.json({ ok: true, skipped: "disabled" });
  const recent = (await listBackups()).find((b) => b.kind === "auto" && Date.now() - new Date(b.createdAt).getTime() < 20 * 3600_000);
  if (recent) return Response.json({ ok: true, skipped: "recent", name: recent.name });

  try {
    const file = await createBackup("auto");
    const pruned = await pruneBackups(settings["backup.keep"], file.name);
    await logAction({ action: "BACKUP_AUTO", module: "backup", entityId: file.name, details: { size: file.size, pruned } });
    return Response.json({ ok: true, name: file.name, size: file.size, pruned });
  } catch (e) {
    await logAction({ action: "BACKUP_FAILED", module: "backup", details: { error: (e as Error).message, auto: true } });
    await notify({ event: "BACKUP_FAILED", title: "สำรองข้อมูลอัตโนมัติล้มเหลว", body: (e as Error).message, href: "/admin/backup" });
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

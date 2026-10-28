import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { logAction } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { backupPath, isBackupName } from "@/modules/backup/service";

/** Download a backup file — admins only, never while impersonating (CLAUDE.md §6, §9). */
export async function GET(_request: Request, ctx: RouteContext<"/api/backups/[name]">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.user.role, "backup", "run") || session.session.impersonatedBy) return new Response("Forbidden", { status: 403 });
  const { name } = await ctx.params;
  if (!isBackupName(name)) return new Response("Not found", { status: 404 });

  const file = backupPath(name);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  await logAction({ userId: session.user.id, action: "DOWNLOAD", module: "backup", entityId: name });
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(size),
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

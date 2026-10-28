import "server-only";
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pkg from "@/package.json";
import { prisma } from "@/lib/prisma";
import { listBackups } from "@/modules/backup/service";

// turbopackIgnore: runtime-only path, keeps output tracing from including the whole project
const STORAGE = path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "storage"));

/** Total bytes and file count under a folder (attachments, signatures, logos), excluding backups. */
async function folderUsage(dir: string, skip: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { bytes, files };
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (full === skip) continue;
    if (e.isDirectory()) {
      const sub = await folderUsage(full, skip);
      bytes += sub.bytes;
      files += sub.files;
    } else if (e.isFile()) {
      bytes += (await stat(full)).size;
      files++;
    }
  }
  return { bytes, files };
}

export async function systemInfo() {
  const [dbRows, counts, files, backups, migration] = await Promise.all([
    prisma.$queryRaw<{ version: string; size: bigint; db: string }[]>`SELECT version() AS version, pg_database_size(current_database()) AS size, current_database() AS db`,
    Promise.all([
      prisma.asset.count({ where: { deletedAt: null } }),
      prisma.ticket.count(),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.pmRun.count(),
      prisma.externalClaim.count(),
      prisma.auditCampaign.count(),
      prisma.attachment.count(),
      prisma.systemAuditLog.count(),
    ]),
    folderUsage(STORAGE, path.join(STORAGE, "backups")),
    listBackups(),
    prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`,
  ]);
  const db = dbRows[0];
  const [assets, tickets, users, pmRuns, claims, campaigns, attachments, logs] = counts;

  return {
    app: { name: pkg.name, version: pkg.version, next: pkg.dependencies.next, prisma: pkg.dependencies["@prisma/client"] },
    runtime: {
      node: process.version,
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      hostname: os.hostname(),
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      env: process.env.NODE_ENV ?? "development",
    },
    database: {
      name: db.db,
      version: db.version.split(",")[0],
      sizeBytes: Number(db.size),
      lastMigration: migration[0]?.migration_name ?? "-",
    },
    counts: { assets, tickets, users, pmRuns, claims, campaigns, attachments, logs },
    storage: { ...files, path: STORAGE },
    backups: { count: backups.length, totalBytes: backups.reduce((n, b) => n + b.size, 0), latest: backups[0] ?? null },
  };
}
export type SystemInfo = Awaited<ReturnType<typeof systemInfo>>;

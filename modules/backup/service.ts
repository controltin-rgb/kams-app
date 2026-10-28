import "server-only";
import { execFile } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// turbopackIgnore: runtime-only path, keeps output tracing from including the whole project
const STORAGE = path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "storage"));
const DIR = path.join(STORAGE, "backups");

export type BackupKind = "manual" | "auto" | "prerestore";
/** File names are generated here only; anything else is rejected (no user-controlled paths). */
const NAME = /^ams-(manual|auto|prerestore)-(\d{8}-\d{6})\.dump$/;

export type BackupFile = { name: string; kind: BackupKind; size: number; createdAt: string };

export function isBackupName(name: string) {
  return NAME.test(name);
}

export function backupPath(name: string) {
  if (!isBackupName(name)) throw new Error("Invalid backup name");
  return path.join(DIR, name);
}

/** Connection settings for the client tools. The password goes through PGPASSWORD, never the command line. */
function connection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not configured");
  const u = new URL(raw);
  return {
    args: ["-h", u.hostname, "-p", u.port || "5432", "-U", decodeURIComponent(u.username), "-d", decodeURIComponent(u.pathname.slice(1))],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password), PGCONNECT_TIMEOUT: "10" },
    database: decodeURIComponent(u.pathname.slice(1)),
  };
}

export function databaseName() {
  return connection().database;
}

function tool(name: "pg_dump" | "pg_restore") {
  const dir = process.env.PG_BIN_DIR;
  return dir ? path.join(dir, process.platform === "win32" ? `${name}.exe` : name) : name;
}

/** Bangkok wall-clock timestamp for file names, e.g. 20261027-153000. */
function stamp(d = new Date()) {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

export async function listBackups(): Promise<BackupFile[]> {
  let names: string[];
  try {
    names = await readdir(DIR);
  } catch {
    return [];
  }
  const files = await Promise.all(
    names.filter(isBackupName).map(async (name) => {
      const s = await stat(path.join(DIR, name));
      return { name, kind: NAME.exec(name)![1] as BackupKind, size: s.size, createdAt: s.mtime.toISOString() };
    }),
  );
  return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Custom-format dump (pg_dump -Fc): compressed, restorable with pg_restore. */
export async function createBackup(kind: BackupKind): Promise<BackupFile> {
  await mkdir(DIR, { recursive: true });
  let name = `ams-${kind}-${stamp()}.dump`;
  // Two backups in the same second (e.g. pre-restore right after a manual one)
  if ((await listBackups()).some((b) => b.name === name)) name = `ams-${kind}-${stamp(new Date(Date.now() + 1000))}.dump`;
  const file = path.join(DIR, name);
  const conn = connection();
  try {
    await run(tool("pg_dump"), [...conn.args, "-Fc", "--no-owner", "--no-privileges", "-f", file], { env: conn.env, timeout: 15 * 60_000, windowsHide: true });
  } catch (e) {
    await rm(file, { force: true });
    throw new Error(`pg_dump ล้มเหลว: ${toolError(e)}`);
  }
  const s = await stat(file);
  return { name, kind, size: s.size, createdAt: s.mtime.toISOString() };
}

/**
 * Replace the current database with a backup. Objects are dropped and recreated in one transaction,
 * so a failed restore leaves the database as it was.
 */
export async function restoreBackup(name: string) {
  const conn = connection();
  try {
    await run(tool("pg_restore"), [...conn.args, "--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", "--exit-on-error", backupPath(name)], {
      env: conn.env,
      timeout: 30 * 60_000,
      windowsHide: true,
    });
  } catch (e) {
    throw new Error(`pg_restore ล้มเหลว: ${toolError(e)}`);
  }
}

/** Keep the newest `keep` backups; never removes `protect` (the one just made). Returns deleted names. */
export async function pruneBackups(keep: number, protect?: string) {
  const all = await listBackups();
  const drop = all.slice(keep).filter((b) => b.name !== protect);
  await Promise.all(drop.map((b) => rm(path.join(DIR, b.name), { force: true })));
  return drop.map((b) => b.name);
}

export async function deleteBackupFile(name: string) {
  await rm(backupPath(name), { force: true });
}

export async function checkTools() {
  try {
    const { stdout } = await run(tool("pg_dump"), ["--version"], { timeout: 10_000, windowsHide: true });
    return { ok: true as const, version: stdout.trim() };
  } catch (e) {
    return { ok: false as const, error: toolError(e) };
  }
}

function toolError(e: unknown) {
  const err = e as { code?: string; stderr?: string; message?: string };
  if (err.code === "ENOENT") return "ไม่พบโปรแกรม pg_dump/pg_restore (ตั้งค่า PG_BIN_DIR ใน .env)";
  // stderr never contains the password (it is passed via env)
  return (err.stderr || err.message || "unknown error").toString().trim().split("\n").slice(-3).join(" ");
}

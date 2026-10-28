import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Atomically reserve the next running number for (key, year).
 * Must run inside `prisma.$transaction` — the upsert takes a row lock so concurrent callers never get the same number.
 */
export async function nextSequence(tx: Tx, key: string, year: number, count = 1): Promise<number> {
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "DocumentSequence" ("key", "year", "last") VALUES (${key}, ${year}, ${count})
    ON CONFLICT ("key", "year") DO UPDATE SET "last" = "DocumentSequence"."last" + ${count}
    RETURNING "last"`;
  return rows[0].last - count + 1; // first number of the reserved block
}

export function currentYear(): number {
  // Year in Asia/Bangkok (Gregorian, stored as ค.ศ.)
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));
}

export function formatAssetCode(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

/** Reserve `count` consecutive asset codes for a category prefix, e.g. PC-2026-0001. */
export async function nextAssetCodes(tx: Tx, prefix: string, count = 1): Promise<string[]> {
  const year = currentYear();
  const first = await nextSequence(tx, `ASSET:${prefix}`, year, count);
  return Array.from({ length: count }, (_, i) => formatAssetCode(prefix, year, first + i));
}

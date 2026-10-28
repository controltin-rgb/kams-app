import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditEntry = {
  action: string; // e.g. LOGIN, LOGOUT, UPDATE_PROFILE, CHANGE_PASSWORD, CREATE, UPDATE, DELETE
  module: string; // e.g. auth, profile, asset, ticket
  userId?: string | null;
  impersonatedBy?: string | null;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
};

type Tx = Pick<typeof prisma, "systemAuditLog">;

async function requestMeta() {
  try {
    const h = await headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    };
  } catch {
    // Called outside a request scope (e.g. scripts)
    return { ip: null, userAgent: null };
  }
}

/** Append an audit record. Pass `tx` to write inside an existing `prisma.$transaction`. */
export async function logAction(entry: AuditEntry, tx: Tx = prisma) {
  const meta = await requestMeta();
  await tx.systemAuditLog.create({
    data: {
      action: entry.action,
      module: entry.module,
      userId: entry.userId ?? null,
      impersonatedBy: entry.impersonatedBy ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
}

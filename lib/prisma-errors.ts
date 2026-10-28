import { Prisma } from "@/generated/prisma/client";

type UniqueMeta = {
  target?: string[] | string;
  // With driver adapters (Prisma 7 + @prisma/adapter-pg) the constraint is reported here instead of `target`
  driverAdapterError?: { cause?: { constraint?: { index?: string; fields?: string[] } } };
};

/** Fields (or the index name) involved in a unique-constraint error. */
function uniqueTargets(meta: UniqueMeta | undefined): string[] {
  if (!meta) return [];
  if (meta.target) return Array.isArray(meta.target) ? meta.target : [meta.target];
  const constraint = meta.driverAdapterError?.cause?.constraint;
  if (constraint?.fields) return constraint.fields;
  // Postgres default index name: "<Table>_<field>_key"
  const m = constraint?.index?.match(/^[^_]+_(.+)_key$/);
  return m ? m[1].split("_") : constraint?.index ? [constraint.index] : [];
}

/** True when a write failed on a unique constraint (optionally on a specific field). */
export function isUniqueViolation(e: unknown, field?: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  if (!field) return true;
  return uniqueTargets(e.meta as UniqueMeta | undefined).includes(field);
}

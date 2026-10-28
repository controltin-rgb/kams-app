import "server-only";
import { prisma } from "@/lib/prisma";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function listClaims() {
  const rows = await prisma.externalClaim.findMany({
    orderBy: { createdAt: "desc" },
    include: { asset: { select: { assetCode: true, name: true } }, vendor: { select: { name: true } }, ticket: { select: { ticketNumber: true } } },
  });
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((c) => ({
    id: c.id,
    claimNumber: c.claimNumber,
    asset: `${c.asset.assetCode} ${c.asset.name}`,
    vendor: c.vendor.name,
    status: c.status,
    sentDate: iso(c.sentDate)!,
    expectedReturnDate: iso(c.expectedReturnDate),
    actualReturnDate: iso(c.actualReturnDate),
    ticketNumber: c.ticket?.ticketNumber ?? "",
    late: ["SENT", "IN_REPAIR"].includes(c.status) && !!c.expectedReturnDate && iso(c.expectedReturnDate)! < today,
    cost: c.cost?.toString() ?? "",
  }));
}
export type ClaimRow = Awaited<ReturnType<typeof listClaims>>[number];

export async function getClaim(id: string) {
  const c = await prisma.externalClaim.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, assetCode: true, name: true, brand: true, model: true, serialNumber: true, warrantyExpiry: true, status: true } },
      vendor: true,
      ticket: { select: { id: true, ticketNumber: true, title: true } },
    },
  });
  if (!c) return null;
  const createdBy = await prisma.user.findUnique({ where: { id: c.createdById }, select: { name: true } });
  return {
    ...c,
    cost: c.cost?.toString() ?? null,
    sentDate: iso(c.sentDate)!,
    expectedReturnDate: iso(c.expectedReturnDate),
    actualReturnDate: iso(c.actualReturnDate),
    createdByName: createdBy?.name ?? null,
  };
}
export type ClaimDetail = NonNullable<Awaited<ReturnType<typeof getClaim>>>;

export async function claimFormOptions() {
  const [assets, vendors, tickets] = await Promise.all([
    prisma.asset.findMany({
      where: { deletedAt: null, status: { notIn: ["DISPOSED", "CLAIMING"] } },
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true, warrantyExpiry: true },
    }),
    prisma.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.ticket.findMany({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, ticketNumber: true, title: true, assetId: true },
    }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return {
    assets: assets.map((a) => {
      const w = iso(a.warrantyExpiry);
      return { value: a.id, label: `${a.assetCode} ${a.name}${w ? (w >= today ? " · ในประกัน" : " · หมดประกัน") : ""}` };
    }),
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
    tickets: tickets.map((t) => ({ value: t.id, label: `${t.ticketNumber} ${t.title}`, assetId: t.assetId })),
  };
}
export type ClaimFormOptions = Awaited<ReturnType<typeof claimFormOptions>>;

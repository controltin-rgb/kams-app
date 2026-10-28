import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { syncSchema } from "@/modules/audits/schemas";
import { applyScan, canScanCampaign, type ScanOutcome } from "@/modules/audits/service";

/**
 * Upload queued scans from the offline scan page. Idempotent per clientUuid, so the device can
 * safely retry after a dropped connection; the response says what happened to each scan.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
  const { campaignId, scans } = parsed.data;

  const user = { id: session.user.id, role: session.user.role };
  if (!(await canScanCampaign(user, campaignId))) return Response.json({ error: "Forbidden" }, { status: 403 });
  const campaign = await prisma.auditCampaign.findUnique({ where: { id: campaignId }, select: { status: true, scopeLocationIds: true } });
  if (!campaign) return Response.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "IN_PROGRESS") {
    return Response.json({ results: scans.map((s): ScanOutcome => ({ clientUuid: s.clientUuid, status: "rejected", message: "รอบตรวจนับไม่ได้เปิดสแกนอยู่" })) });
  }

  const results = await prisma.$transaction(
    async (tx) => {
      const out: ScanOutcome[] = [];
      for (const scan of scans) out.push(await applyScan(tx, campaignId, scan, user.id));
      const applied = out.filter((r) => r.status === "applied").length;
      if (applied) {
        await logAction({ userId: user.id, impersonatedBy: session.session.impersonatedBy, action: "SCAN_SYNC", module: "audit", entityId: campaignId, details: { applied, duplicate: out.length - applied } }, tx);
      }
      return out;
    },
    { timeout: 60_000 },
  );
  return Response.json({ results });
}

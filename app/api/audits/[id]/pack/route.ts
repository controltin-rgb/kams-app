import { getSession } from "@/lib/session";
import { scanPack } from "@/modules/audits/queries";
import { canScanCampaign } from "@/modules/audits/service";

/** Offline data for the scan page: in-scope locations and a lookup of registered assets. */
export async function GET(_request: Request, ctx: RouteContext<"/api/audits/[id]/pack">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await canScanCampaign({ id: session.user.id, role: session.user.role }, id))) return Response.json({ error: "Forbidden" }, { status: 403 });
  const pack = await scanPack(id);
  if (!pack) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(pack, { headers: { "cache-control": "no-store" } });
}

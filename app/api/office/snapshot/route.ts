import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { buildSnapshot } from "@/modules/office3d/snapshot";

/** Current state of the 3D Office for the signed-in user (already filtered by permission). */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "office3d", "view")) return Response.json({ error: "Forbidden" }, { status: 403 });
  const snapshot = await buildSnapshot({ id: session.user.id, role: session.user.role });
  return Response.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
}

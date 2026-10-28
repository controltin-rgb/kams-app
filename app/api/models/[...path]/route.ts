import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";

/** 3D Office models live outside /public and are only served to users who may open the 3D Office. */
// turbopackIgnore: runtime-only path, keeps output tracing from including the whole project
const ROOT = path.resolve(/* turbopackIgnore: true */ process.env.MODELS_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "3dmodels"));

const types: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".json": "application/json; charset=utf-8",
  ".ktx2": "image/ktx2",
};

export async function GET(request: Request, ctx: RouteContext<"/api/models/[...path]">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.user.role, "office3d", "view")) return new Response("Forbidden", { status: 403 });

  const { path: segments } = await ctx.params;
  const file = path.resolve(ROOT, ...segments);
  // Only known model types inside ROOT (no traversal, no README/other files)
  const type = types[path.extname(file).toLowerCase()];
  if (!file.startsWith(ROOT + path.sep) || !type) return new Response("Not found", { status: 404 });

  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });

  const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const headers = { ETag: etag, "Cache-Control": "private, max-age=3600, must-revalidate", "X-Content-Type-Options": "nosniff" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  return new Response(new Uint8Array(await readFile(file)), {
    headers: { ...headers, "Content-Type": type, "Content-Length": String(info.size) },
  });
}

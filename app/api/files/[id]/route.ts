import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { readStoredFile } from "@/lib/storage";
import { ticketAbilities } from "@/modules/tickets/workflow";

/** Serve an uploaded file after checking the viewer may see the record it belongs to. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;

  const att = await prisma.attachment.findUnique({
    where: { id },
    include: { ticket: { select: { reporterId: true, assignedTechId: true, status: true } } },
  });
  if (!att) return new Response("Not found", { status: 404 });

  const user = { id: session.user.id, role: session.user.role };
  const allowed = att.ticket
    ? ticketAbilities(user, att.ticket).view
    : att.transferId
      ? can(user.role, "deployment", "view")
      : att.assetId
        ? can(user.role, "asset", "view")
        : att.labelTemplateId
          ? can(user.role, "label", "view")
          : false;
  if (!allowed) return new Response("Not found", { status: 404 });

  let data: Buffer;
  try {
    data = await readStoredFile(att.storageKey);
  } catch {
    return new Response("File missing", { status: 410 });
  }

  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": att.mime,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
      // Prevent uploaded PDFs/images from running scripts in our origin
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

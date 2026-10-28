import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sseFrame, toMessage } from "@/modules/office3d/stream";

const POLL_MS = 1000;
const PING_MS = 15_000;
/** Streams end after this long; EventSource reconnects (with Last-Event-ID), which re-checks the session and permission */
const MAX_AGE_MS = 10 * 60_000;
const MAX_PER_USER = 2;
const BATCH = 100;
const KEEP_DAYS = 7;

// Survives dev hot reloads, so connection counts are not lost while editing
const state = globalThis as unknown as { office3dStreams?: Map<string, number>; office3dPrunedAt?: number };
const open = (state.office3dStreams ??= new Map());

/** Old events are only useful to clients catching up after a short disconnect; drop them now and then. */
async function pruneOldEvents() {
  if (Date.now() - (state.office3dPrunedAt ?? 0) < 3_600_000) return;
  state.office3dPrunedAt = Date.now();
  await prisma.sceneEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
}

/**
 * Live scene events for the 3D Office (IMPLEMENTATION.md §6.3): Server-Sent Events, polling SceneEvent every second.
 * Resumes after `Last-Event-ID` (set by EventSource on reconnect) or `?after=` (the snapshot's lastEventId).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "office3d", "view")) return Response.json({ error: "Forbidden" }, { status: 403 });

  const userId = session.user.id;
  if ((open.get(userId) ?? 0) >= MAX_PER_USER) return Response.json({ error: "Too many connections" }, { status: 429 });

  const viewer = { id: userId, role: session.user.role };
  const resumeFrom = request.headers.get("last-event-id") ?? new URL(request.url).searchParams.get("after");
  let cursor: bigint;
  if (resumeFrom && /^\d{1,19}$/.test(resumeFrom)) cursor = BigInt(resumeFrom);
  else cursor = (await prisma.sceneEvent.findFirst({ orderBy: { id: "desc" }, select: { id: true } }))?.id ?? BigInt(0);
  void pruneOldEvents().catch(() => {});

  open.set(userId, (open.get(userId) ?? 0) + 1);
  const encoder = new TextEncoder();
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = () => {
    if (closed) return false;
    closed = true;
    clearTimeout(timer);
    open.set(userId, Math.max(0, (open.get(userId) ?? 1) - 1));
    return true;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const started = Date.now();
      let lastWrite = Date.now();
      const close = () => {
        if (!release()) return;
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      const write = (text: string) => {
        controller.enqueue(encoder.encode(text));
        lastWrite = Date.now();
      };
      request.signal.addEventListener("abort", close);

      const poll = async () => {
        if (closed) return;
        let more = false;
        try {
          const rows = await prisma.sceneEvent.findMany({ where: { id: { gt: cursor } }, orderBy: { id: "asc" }, take: BATCH });
          if (closed) return;
          more = rows.length === BATCH;
          for (const row of rows) {
            cursor = row.id;
            const message = toMessage(row, viewer);
            if (message) write(sseFrame(message));
          }
          if (Date.now() - lastWrite >= PING_MS) write(": ping\n\n");
          if (Date.now() - started >= MAX_AGE_MS) return close();
        } catch {
          return close(); // EventSource retries
        }
        timer = setTimeout(poll, more ? 0 : POLL_MS);
      };
      write("retry: 3000\n\n");
      void poll();
    },
    cancel() {
      release();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, type Action, type Resource } from "@/lib/permissions";
import { loadRoles } from "@/lib/roles";

/** Current session for this request (deduplicated), or null. */
export const getSession = cache(async () => {
  // Role permissions are edited in the UI; refresh them before any can() check in this request
  // headers() first: it marks the render as request-time, so the queries below are not seen as uncached prerender data
  const requestHeaders = await headers();
  const [session] = await Promise.all([auth.api.getSession({ headers: requestHeaders }), loadRoles()]);
  return session;
});

/** Session or redirect to the signin page. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/auth");
  return session;
}

/** Session with the given permission, or render the 403 page. Use in pages, server actions and route handlers. */
export async function requirePermission<R extends Resource>(resource: R, action: Action<R>) {
  const session = await requireSession();
  if (!can(session.user.role, resource, action)) forbidden();
  return session;
}

/**
 * Like requirePermission, but refuses while impersonating (CLAUDE.md §6: no backup/restore/clear log
 * on someone else's behalf). Returns null instead of throwing so actions can show a message.
 */
export async function requireOwnSession<R extends Resource>(resource: R, action: Action<R>) {
  const session = await requirePermission(resource, action);
  return session.session.impersonatedBy ? null : session;
}

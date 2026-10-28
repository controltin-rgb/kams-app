import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { safeNextPath } from "@/lib/safe-redirect";

// Optimistic check only (cookie presence). Real validation happens server-side
// via auth.api.getSession in the protected layout.
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);

  // Public landing page: visible to everyone, signed in or not.
  if (pathname === "/") return NextResponse.next();

  if (pathname === "/auth") {
    return hasSession ? NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), request.url)) : NextResponse.next();
  }
  if (!hasSession) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|api/files|api/models|api/office|api/cron|api/audits|a/|sw.js|manifest.webmanifest|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

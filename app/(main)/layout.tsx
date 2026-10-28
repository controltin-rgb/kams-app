import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { permissionsOf } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { roleLabel, roleNames } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { AppShell } from "./app-shell";

async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/auth");

  const { name } = session.user;
  const role = session.user.role ?? "user";
  // The client shell filters the sidebar with the same (edited) permissions as the server
  const permissions = Object.fromEntries(role.split(",").map((r) => [r.trim(), permissionsOf(r.trim())]));
  const by = session.session.impersonatedBy;
  const impersonator = by ? ((await prisma.user.findUnique({ where: { id: by }, select: { name: true } }))?.name ?? "ผู้ดูแลระบบ") : null;
  return (
    <AppShell user={{ name, role, roleLabel: roleLabel(role, await roleNames()) }} permissions={permissions} impersonator={impersonator}>
      {children}
    </AppShell>
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

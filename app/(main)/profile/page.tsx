import type { Metadata } from "next";
import { KeyRound, UserRound } from "lucide-react";
import { GradientIcon } from "@/components/gradient-icon";
import { prisma } from "@/lib/prisma";
import { roleNames } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils/date";
import { PasswordForm, ProfileForm } from "./profile-forms";

export const metadata: Metadata = { title: "Profile | AMS" };

function Section({ id, title, icon, children, delay }: { id?: string; title: string; icon: React.ReactNode; children: React.ReactNode; delay: number }) {
  return (
    <section id={id} className="animate-fade-up scroll-mt-28 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-5 flex items-center gap-3 text-lg font-semibold">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ProfilePage() {
  const { user } = await requireSession();
  const extra = await prisma.user.findUnique({ where: { id: user.id }, select: { lineUserId: true } });
  const names = await roleNames();
  const roles = (user.role ?? "user").split(",").map((r) => names[r.trim()] ?? r.trim());

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex animate-fade-up flex-col items-center gap-5 rounded-[28px] bg-hero p-6 text-center sm:flex-row sm:p-8 sm:text-left">
        <span className="flex size-20 shrink-0 animate-pop items-center justify-center rounded-3xl bg-brand text-3xl font-bold text-white shadow-xl shadow-brand/30">
          {user.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{user.name}</h1>
          <p className="mt-1 text-muted-foreground">@{user.username}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            {roles.map((r) => (
              <span key={r} className="rounded-full bg-card/80 px-3 py-1 text-sm font-semibold text-brand">
                {r}
              </span>
            ))}
          </div>
        </div>
        <dl className="text-sm text-muted-foreground sm:text-right">
          <dt>สมาชิกตั้งแต่</dt>
          <dd className="font-semibold text-foreground">{formatDateTime(user.createdAt)}</dd>
        </dl>
      </div>

      <Section title="ข้อมูลส่วนตัว" icon={<GradientIcon icon={UserRound} tone="violet" />} delay={80}>
        <ProfileForm name={user.name} email={user.email} lineUserId={extra?.lineUserId ?? null} />
      </Section>

      <Section id="password" title="เปลี่ยนรหัสผ่าน" icon={<GradientIcon icon={KeyRound} tone="orange" />} delay={160}>
        <PasswordForm />
      </Section>
    </div>
  );
}

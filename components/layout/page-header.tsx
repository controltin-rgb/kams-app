import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { GradientIcon, type Tone } from "@/components/gradient-icon";

export function PageHeader({
  icon,
  tone,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex animate-fade-up flex-wrap items-center justify-between gap-4 print:hidden">
      <div className="flex min-w-0 items-center gap-4">
        <GradientIcon icon={icon} tone={tone} className="size-14 rounded-2xl" iconClass="size-7" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{title}</h1>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "", delay = 80 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <section
      className={`animate-fade-up rounded-[28px] bg-card p-4 shadow-sm shadow-black/4 sm:p-6 print:p-0 print:shadow-none ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}

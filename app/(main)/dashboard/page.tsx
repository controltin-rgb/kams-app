import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlarmClock,
  BarChart3,
  Bell,
  CalendarCheck,
  ClipboardCheck,
  Home,
  LineChart,
  MonitorSmartphone,
  PieChart,
  Plus,
  Truck,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { GradientIcon, type Tone } from "@/components/gradient-icon";
import { PmRunStatusBadge } from "@/components/pm-badges";
import { SlaBadge, TicketPriorityBadge, TicketStatusBadge } from "@/components/ticket-badges";
import { Button } from "@/components/ui/button";
import type { AssetStatus } from "@/generated/prisma/enums";
import { assetStatusLabels } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { monthRange } from "@/modules/dashboard/month";
import { myCampaigns, myItems, myWork, orgOverview, type OrgOverview } from "@/modules/dashboard/queries";
import { Donut, HBars, LineArea, VBars } from "./charts";
import { MonthPicker } from "./month-picker";

export const metadata: Metadata = { title: "Dashboard | AMS" };

const statusColors: Record<AssetStatus, string> = {
  SPARE: "#3b7de8",
  ACTIVE: "#19c3b0",
  IN_USE: "#1fbf6b",
  IN_MAINTENANCE: "#ff8a1f",
  CLAIMING: "#f5b400",
  PENDING_DISPOSAL: "#f0457f",
  DISPOSED: "#7c5ce6",
};
const palette = ["#3b7de8", "#26bf6e", "#ff8a1f", "#7c5ce6", "#19c3b0", "#f0457f", "#f5b400", "#4fb3f6"];
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

function Card({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <section className={`animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </section>
  );
}

function Stat({ icon, tone, blob, delay, href, children }: { icon: LucideIcon; tone: Tone; blob: string; delay: number; href?: string; children: ReactNode }) {
  const body = (
    <Card delay={delay} className="group relative h-full overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
      <div className={`absolute -right-12 -top-16 size-40 rounded-full transition-transform duration-500 group-hover:scale-125 ${blob}`} />
      <div className="relative">
        <GradientIcon icon={icon} tone={tone} className="size-14.5 rounded-2xl" iconClass="size-7" />
        <div className="mt-5">{children}</div>
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
      {body}
    </Link>
  ) : (
    body
  );
}

function BigNumber({ value, unit }: { value: number | string; unit: string }) {
  return (
    <div className="mt-1 flex items-baseline gap-2">
      <span className="text-4xl font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{unit}</span>
    </div>
  );
}

function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>{children}</span>;
}

function ChartTitle({ icon: Icon, children, className = "mb-6" }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <h2 className={`flex items-center gap-3 text-lg font-semibold sm:text-xl ${className}`}>
      <Icon className="size-6" /> {children}
    </h2>
  );
}

function ListCard({ icon, title, delay, empty, action, children }: { icon: LucideIcon; title: string; delay: number; empty: string; action?: ReactNode; children: ReactNode[] }) {
  return (
    <Card delay={delay}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ChartTitle icon={icon} className="">
          {title}
        </ChartTitle>
        {action}
      </div>
      {children.length ? <ul className="divide-y divide-border">{children}</ul> : <p className="py-6 text-center text-muted-foreground">{empty}</p>}
    </Card>
  );
}

function Row({ href, title, sub, right }: { href: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/60">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{title}</div>
          {sub && <div className="truncate text-sm text-muted-foreground">{sub}</div>}
        </div>
        {right && <div className="flex shrink-0 flex-wrap justify-end gap-1">{right}</div>}
      </Link>
    </li>
  );
}

function Header({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex animate-fade-up flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <GradientIcon icon={Home} tone="violet" className="size-14 rounded-2xl sm:size-19 sm:rounded-3xl" iconClass="size-7 sm:size-9" />
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions}
    </div>
  );
}

function OrgSection({ o, monthLabel }: { o: OrgOverview; monthLabel: string }) {
  const { assets, tickets, pm, claims, activity, series } = o;
  const pct = assets.total ? Math.round((assets.inUse / assets.total) * 100) : 0;
  const top = assets.byCategory.slice(0, 3);
  const months = series.tickets.map((m) => m.label);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={MonitorSmartphone} tone="blue" blob="bg-blue-100/70 dark:bg-blue-500/10" delay={60} href="/assets">
          <div className="text-muted-foreground">ครุภัณฑ์ทั้งหมด</div>
          <BigNumber value={assets.total} unit="รายการ" />
          <div className="mt-1 text-sm text-muted-foreground">ลงทะเบียนใหม่ในเดือนที่เลือก {assets.newThisMonth} รายการ</div>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
            {top.map((t) => (
              <li key={t.label} className="flex justify-between gap-2">
                <span className="truncate">{t.label}</span> <span className="font-semibold text-foreground">{t.value}</span>
              </li>
            ))}
          </ul>
        </Stat>
        <Stat icon={UserCheck} tone="green" blob="bg-emerald-100/70 dark:bg-emerald-500/10" delay={120} href="/assets">
          <div className="text-muted-foreground">ใช้งานอยู่ / พร้อมใช้</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">{assets.inUse}</span>
            <span className="text-muted-foreground">
              / {assets.total} ({pct}%)
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">สำรอง/ในคลัง {assets.status.SPARE ?? 0}</Chip>
          </div>
        </Stat>
        <Stat icon={Wrench} tone="orange" blob="bg-orange-100/70 dark:bg-orange-500/10" delay={180} href="/tickets">
          <div className="text-muted-foreground">ระหว่างซ่อม / ส่งเคลม</div>
          <BigNumber value={(assets.status.IN_MAINTENANCE ?? 0) + (assets.status.CLAIMING ?? 0)} unit="เครื่อง" />
          <div className="mt-1 text-sm text-muted-foreground">
            ซ่อม {assets.status.IN_MAINTENANCE ?? 0} · เคลม {assets.status.CLAIMING ?? 0}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            รอจำหน่าย {assets.status.PENDING_DISPOSAL ?? 0} · จำหน่ายแล้ว {assets.status.DISPOSED ?? 0}
          </div>
        </Stat>
        <Stat icon={Bell} tone="pink" blob="bg-pink-100/70 dark:bg-pink-500/10" delay={240}>
          <div className="text-muted-foreground">ประกันใกล้หมด (≤ 30 วัน)</div>
          <BigNumber value={assets.warrantySoon} unit="รายการ" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300">หมดประกันแต่ยังใช้งาน {assets.warrantyExpired}</Chip>
          </div>
        </Stat>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Stat icon={AlarmClock} tone="red" blob="bg-red-100/70 dark:bg-red-500/10" delay={300} href="/tickets">
          <div className="text-muted-foreground">งานแจ้งซ่อมค้าง</div>
          <BigNumber value={tickets.open} unit="งาน" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">เกิน SLA {tickets.overdue}</Chip>
            <Chip tone="bg-muted text-foreground/80">
              เดือนนี้ เปิด {tickets.opened} · ปิด {tickets.closed}
            </Chip>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">ค่าซ่อมงานที่ปิดในเดือน {money.format(Number(tickets.repairCost))}</div>
        </Stat>
        <Stat icon={CalendarCheck} tone="teal" blob="bg-teal-100/70 dark:bg-teal-500/10" delay={360} href="/pm">
          <div className="text-muted-foreground">PM ครบกำหนดใน 7 วัน</div>
          <BigNumber value={pm.due} unit="งาน" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">เลยกำหนด {pm.overdue}</Chip>
            <Chip tone="bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">ทำแล้วในเดือน {pm.done}</Chip>
          </div>
        </Stat>
        <Stat icon={Truck} tone="blue" blob="bg-sky-100/70 dark:bg-sky-500/10" delay={420} href="/claims">
          <div className="text-muted-foreground">อยู่ระหว่างเคลม</div>
          <BigNumber value={claims.open} unit="รายการ" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">เกินกำหนดรับคืน {claims.late}</Chip>
          </div>
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card delay={480}>
          <ChartTitle icon={PieChart}>สัดส่วนตามสถานะ</ChartTitle>
          <Donut data={(Object.keys(statusColors) as AssetStatus[]).map((s) => ({ label: assetStatusLabels[s], value: assets.status[s] ?? 0, color: statusColors[s] }))} />
        </Card>
        <Card delay={540}>
          <ChartTitle icon={BarChart3}>จำนวนตามประเภทครุภัณฑ์</ChartTitle>
          {assets.byCategory.length ? (
            <VBars data={assets.byCategory.slice(0, 8).map((c, i) => ({ ...c, color: palette[i % palette.length] }))} />
          ) : (
            <p className="py-10 text-center text-muted-foreground">ยังไม่มีครุภัณฑ์</p>
          )}
        </Card>
        <Card delay={600}>
          <ChartTitle icon={LineChart}>งานแจ้งซ่อมรายเดือน (12 เดือนถึง {monthLabel})</ChartTitle>
          <LineArea label="งานแจ้งซ่อมรายเดือน" labels={months} values={series.tickets.map((m) => m.value)} color="#ff8a1f" />
        </Card>
        <Card delay={660}>
          <ChartTitle icon={Activity}>กิจกรรมในเดือนที่เลือก</ChartTitle>
          <HBars
            data={[
              { label: "ลงทะเบียน", value: activity.registered, color: "#7c5ce6" },
              { label: "ส่งมอบ/ย้าย", value: activity.transfers, color: "#4fb3f6" },
              { label: "แจ้งซ่อม", value: activity.ticketsOpened, color: "#ff8a1f" },
              { label: "ปิดงานซ่อม", value: activity.ticketsClosed, color: "#1fbf6b" },
              { label: "PM เสร็จ", value: activity.pmDone, color: "#19c3b0" },
              { label: "ส่งเคลม", value: activity.claimsSent, color: "#f0457f" },
            ]}
          />
        </Card>
        <Card delay={720}>
          <ChartTitle icon={LineChart}>ลงทะเบียนครุภัณฑ์รายเดือน (12 เดือนถึง {monthLabel})</ChartTitle>
          <LineArea label="ลงทะเบียนครุภัณฑ์รายเดือน" labels={months} values={series.assets.map((m) => m.value)} />
        </Card>
        <ListCard icon={AlarmClock} title="งานแจ้งซ่อมที่เกิน SLA" delay={780} empty="ไม่มีงานเกิน SLA">
          {tickets.overdueList.map((t) => (
            <Row
              key={t.id}
              href={`/tickets/${t.id}`}
              title={
                <>
                  <span className="font-mono text-sm text-primary">{t.ticketNumber}</span> {t.title}
                </>
              }
              sub={`กำหนด ${formatDateTime(t.dueAt)} · ${t.assignedTech?.name ?? "ยังไม่มอบหมาย"}`}
              right={<TicketPriorityBadge priority={t.priority} />}
            />
          ))}
        </ListCard>
      </div>
    </>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await requireSession();
  const { id, name, role } = session.user;
  const { month } = await searchParams;
  const range = monthRange(typeof month === "string" ? month : undefined);

  const showOrg = can(role, "report", "view");
  const techPerms = can(role, "ticket", "update") || can(role, "pm", "execute");
  const auditorOnly = can(role, "audit", "scan") && !can(role, "audit", "create");

  const [org, work, items, campaigns] = await Promise.all([
    showOrg ? orgOverview(range) : null,
    techPerms ? myWork({ id }) : null,
    showOrg ? null : myItems({ id }),
    auditorOnly ? myCampaigns({ id }) : null,
  ]);
  // Admins/managers see "my work" only when something is actually assigned to them
  const showWork = !!work && (!showOrg || work.tickets.length > 0 || work.runs.length > 0);

  return (
    <div className="mx-auto max-w-400 space-y-6">
      {org ? (
        <Header
          title="Dashboard"
          description={`ภาพรวมครุภัณฑ์และงานซ่อมบำรุง ประจำเดือน ${range.label}`}
          actions={<MonthPicker month={range.month} max={monthRange().month} office3d={can(role, "office3d", "view")} />}
        />
      ) : (
        <Header title={`สวัสดี ${name}`} description="งานและครุภัณฑ์ของคุณ" />
      )}

      {org && <OrgSection o={org} monthLabel={range.label} />}

      {showWork && work && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ListCard icon={Wrench} title={`งานซ่อมที่ได้รับมอบหมาย (${work.tickets.length})`} delay={showOrg ? 840 : 60} empty="ไม่มีงานค้าง">
            {work.tickets.slice(0, 8).map((t) => (
              <Row
                key={t.id}
                href={`/tickets/${t.id}`}
                title={
                  <>
                    <span className="font-mono text-sm text-primary">{t.ticketNumber}</span> {t.title}
                  </>
                }
                sub={t.dueAt ? `กำหนด ${formatDateTime(t.dueAt)}` : undefined}
                right={
                  <>
                    <SlaBadge state={t.sla} />
                    <TicketPriorityBadge priority={t.priority} />
                  </>
                }
              />
            ))}
          </ListCard>
          <ListCard icon={CalendarCheck} title={`งาน PM ของฉัน (${work.runs.length})`} delay={showOrg ? 900 : 120} empty="ไม่มีงาน PM ค้าง">
            {work.runs.slice(0, 8).map((r) => (
              <Row key={r.id} href={`/pm/runs/${r.id}`} title={r.title} sub={`ครบกำหนด ${formatDate(r.dueDate)}`} right={<PmRunStatusBadge status={r.status} />} />
            ))}
          </ListCard>
        </div>
      )}

      {campaigns && (
        <ListCard icon={ClipboardCheck} title="รอบตรวจนับที่ได้รับมอบหมาย" delay={60} empty="ไม่มีรอบตรวจนับที่เปิดอยู่">
          {campaigns.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <Link href={`/audits/${c.id}`} className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.title}</div>
                <div className="text-sm text-muted-foreground">
                  สิ้นสุด {formatDate(c.endDate)} · สแกนแล้ว {c._count.records} รายการ
                </div>
              </Link>
              <Button asChild variant="gradient" size="sm" className="rounded-lg">
                {/* Full page load so the scan page is cached for offline use */}
                <a href={`/audits/${c.id}/scan`}>สแกน</a>
              </Button>
            </li>
          ))}
        </ListCard>
      )}

      {items && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ListCard icon={MonitorSmartphone} title={`ครุภัณฑ์ที่ฉันถือครอง (${items.assets.length})`} delay={180} empty="ยังไม่มีครุภัณฑ์ที่ถือครอง">
            {items.assets.map((a) => (
              <Row key={a.id} href={`/assets/${a.id}`} title={<span className="font-mono text-sm text-primary">{a.assetCode}</span>} sub={a.name} right={<AssetStatusBadge status={a.status} />} />
            ))}
          </ListCard>
          <ListCard
            icon={Wrench}
            title={`งานแจ้งซ่อมของฉัน (ค้าง ${items.openTickets})`}
            delay={240}
            empty="ยังไม่เคยแจ้งซ่อม"
            action={
              can(role, "ticket", "create") && (
                <Button asChild variant="gradient" size="sm" className="rounded-lg">
                  <Link href="/tickets/new">
                    <Plus /> แจ้งซ่อม
                  </Link>
                </Button>
              )
            }
          >
            {items.tickets.map((t) => (
              <Row
                key={t.id}
                href={`/tickets/${t.id}`}
                title={
                  <>
                    <span className="font-mono text-sm text-primary">{t.ticketNumber}</span> {t.title}
                  </>
                }
                sub={formatDateTime(t.createdAt)}
                right={<TicketStatusBadge status={t.status} />}
              />
            ))}
          </ListCard>
        </div>
      )}
    </div>
  );
}

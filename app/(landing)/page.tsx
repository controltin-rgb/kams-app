import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeftRight,
  BarChart3,
  Blocks,
  Box,
  CalendarCheck,
  ClipboardCheck,
  Headset,
  MonitorSmartphone,
  QrCode,
  ShieldCheck,
  Tag,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { GradientIcon, type Tone } from "@/components/gradient-icon";
import { Button } from "@/components/ui/button";
import { LandingNav } from "./landing-nav";
import { CountUp, Reveal } from "./reveal";

export const metadata: Metadata = {
  title: "AMS | ระบบบริหารครุภัณฑ์และงานแจ้งซ่อม",
  description: "ระบบบริหารครุภัณฑ์และงานแจ้งซ่อมครบวงจร ตั้งแต่ลงทะเบียน แจ้งซ่อม ตรวจนับ จนถึงจำหน่าย",
};

type Item = { icon: LucideIcon; tone: Tone; title: string; text: string };

const features: Item[] = [
  { icon: MonitorSmartphone, tone: "orange", title: "ทะเบียนครุภัณฑ์", text: "ลงทะเบียนครุภัณฑ์พร้อมคุณสมบัติเฉพาะหมวด ประวัติผู้ถือครองและสถานที่ครบถ้วน" },
  { icon: QrCode, tone: "violet", title: "QR / Barcode", text: "สแกนดูประวัติและแจ้งซ่อมได้ทันทีจากสติกเกอร์บนตัวเครื่อง ไม่ต้องล็อกอิน" },
  { icon: Headset, tone: "pink", title: "แจ้งซ่อมและ Helpdesk", text: "เปิดงาน มอบหมายช่าง ติดตามสถานะ บันทึกอะไหล่และค่าใช้จ่าย พร้อม SLA" },
  { icon: ArrowLeftRight, tone: "green", title: "Bundle และ Swap", text: "จัดชุดอุปกรณ์แม่-ลูก เปลี่ยนเครื่องทั้งชุดหรือบางชิ้น พร้อมใบเปลี่ยนเครื่อง" },
  { icon: ClipboardCheck, tone: "blue", title: "ตรวจนับครุภัณฑ์", text: "สแกนตรวจนับจากมือถือ ใช้งานออฟไลน์ได้ แล้วซิงก์และสรุปผลต่างอัตโนมัติ" },
  { icon: BarChart3, tone: "teal", title: "รายงานและแดชบอร์ด", text: "เห็นภาพรวมสถานะครุภัณฑ์ งานซ่อม และค่าใช้จ่าย ส่งออก Excel/CSV ได้" },
];

const steps = [
  { n: "01", title: "ลงทะเบียน", text: "บันทึกครุภัณฑ์ เข้าระบบด้วยการสร้างทีละรายการหรือนำเข้าจาก Excel" },
  { n: "02", title: "ติดป้าย", text: "พิมพ์ฉลาก QR/Barcode ออกแบบเองได้ แล้วติดบนครุภัณฑ์" },
  { n: "03", title: "ใช้งานและแจ้งซ่อม", text: "ผู้ใช้สแกนเพื่อแจ้งซ่อม ช่างรับงานและอัปเดตสถานะจนปิดงาน" },
  { n: "04", title: "ตรวจนับและรายงาน", text: "ตรวจนับประจำปี ปรับปรุงข้อมูล และดูรายงานภาพรวมของทั้งองค์กร" },
];

const modules: Item[] = [
  { icon: Box, tone: "orange", title: "Asset", text: "ทะเบียน หมวดหมู่ สถานที่ แผนก" },
  { icon: ArrowLeftRight, tone: "green", title: "Deployment", text: "ผู้ถือครอง Bundle Swap" },
  { icon: Wrench, tone: "pink", title: "Ticket", text: "แจ้งซ่อม อะไหล่ SLA" },
  { icon: CalendarCheck, tone: "violet", title: "PM", text: "บำรุงรักษาตามรอบ" },
  { icon: ShieldCheck, tone: "red", title: "Vendor Claim", text: "ส่งเคลมและติดตามผล" },
  { icon: ClipboardCheck, tone: "blue", title: "Stock Take", text: "ตรวจนับด้วยมือถือ" },
  { icon: Tag, tone: "teal", title: "Label Editor", text: "ออกแบบและพิมพ์ฉลาก" },
  { icon: Blocks, tone: "orange", title: "Admin", text: "สิทธิ์ Audit Log Backup" },
];

const stats = [
  { to: 8, suffix: "", label: "โมดูลหลัก" },
  { to: 5, suffix: "", label: "บทบาทผู้ใช้" },
  { to: 3, suffix: "", label: "ประเภทงานซ่อม" },
  { to: 78, suffix: "", label: "โมเดล 3D" },
];

const ticker = ["ทะเบียนครุภัณฑ์", "แจ้งซ่อม", "QR Code", "ตรวจนับ", "PM", "เคลมประกัน", "พิมพ์ฉลาก", "Audit Log", "3D Office", "รายงาน"];

function SectionHead({ id, kicker, title, text }: { id?: string; kicker: string; title: string; text?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p id={id} className="scroll-mt-28 text-sm font-semibold tracking-wide text-primary">{kicker}</p>
      <h2 className="mt-3 text-3xl font-bold leading-snug sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-muted-foreground">{text}</p>}
    </Reveal>
  );
}

function HeroMock() {
  const bars = [40, 65, 50, 80, 60, 92, 70];
  const rows: { name: string; status: string; tone: string }[] = [
    { name: "โน้ตบุ๊ก Dell · AST-2026-0012", status: "ใช้งาน", tone: "bg-emerald-500" },
    { name: "เครื่องพิมพ์ HP · AST-2026-0031", status: "ซ่อม", tone: "bg-orange-500" },
    { name: "จอมอนิเตอร์ LG · AST-2026-0048", status: "สำรอง", tone: "bg-blue-500" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-lg animate-float">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-linear-to-br from-[#ff8a1f]/30 via-[#f0457f]/25 to-[#7c5ce6]/30 blur-2xl" />
      <div className="rounded-3xl border bg-card p-5 shadow-2xl shadow-black/10 dark:shadow-black/40">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-red-400" />
            <span className="size-3 rounded-full bg-amber-400" />
            <span className="size-3 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs text-muted-foreground">Dashboard</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ["ครุภัณฑ์", "1,248", "text-primary"],
            ["งานซ่อม", "23", "text-orange-500"],
            ["ถึงรอบ PM", "9", "text-emerald-500"],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-2xl bg-muted p-3">
              <p className="text-[11px] text-muted-foreground">{l}</p>
              <p className={`mt-1 text-xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex h-28 items-end gap-2 rounded-2xl bg-muted p-3">
          {bars.map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}%`, animationDelay: `${600 + i * 90}ms` }}
              className="flex-1 origin-bottom animate-grow-y rounded-t-lg bg-linear-to-t from-[#7c5ce6] to-[#a07bff]"
            />
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.name}
              style={{ animationDelay: `${900 + i * 150}ms` }}
              className="flex animate-slide-in items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs"
            >
              <span className="truncate">{r.name}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <span className={`size-2 rounded-full ${r.tone}`} /> {r.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -right-3 -top-5 hidden animate-pop items-center gap-2 rounded-2xl border bg-card px-3 py-2 text-xs font-medium shadow-xl [animation-delay:1.2s] sm:flex">
        <QrCode className="size-4 text-primary" /> สแกนเพื่อแจ้งซ่อม
      </div>
      <div className="absolute -bottom-5 -left-3 hidden animate-pop items-center gap-2 rounded-2xl border bg-card px-3 py-2 text-xs font-medium shadow-xl [animation-delay:1.5s] sm:flex">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping-slow rounded-full bg-emerald-400" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
        ปิดงานซ่อมแล้ว
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div id="top" className="relative overflow-x-hidden">
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero px-4 pb-24 pt-32 sm:px-6 lg:pt-40">
        <div className="pointer-events-none absolute -left-24 top-20 size-96 animate-float rounded-full bg-orange-200/50 blob blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 size-96 animate-float rounded-full bg-pink-200/50 blob blur-3xl [animation-delay:-4s]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 size-225 -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full border border-dashed border-primary/10" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
          <div className="text-center lg:text-left">
            <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border bg-card/70 px-4 py-1.5 text-sm backdrop-blur">
              <span className="size-2 rounded-full bg-emerald-500" /> Asset Management and Ticket System
            </span>
            <h1 className="mt-6 animate-fade-up text-4xl font-bold leading-[1.35] [animation-delay:100ms] sm:text-5xl lg:text-6xl lg:leading-[1.3]">
              บริหารครุภัณฑ์และงานซ่อม
              <br />
              <span className="animate-gradient bg-linear-to-r from-[#ff8a1f] via-[#f0457f] to-[#7c5ce6] bg-size[200%_auto] bg-clip-text text-transparent">
                ได้ในที่เดียว
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl animate-fade-up text-lg leading-8 text-muted-foreground [animation-delay:200ms] lg:mx-0">
              ตั้งแต่ลงทะเบียน ติดป้าย QR แจ้งซ่อม บำรุงรักษา ตรวจนับ จนถึงจำหน่าย
              ครบทั้ง IT Support งานอาคาร/ไฟฟ้า และงานทั่วไป
            </p>
            <div className="mt-9 flex animate-fade-up flex-col items-center gap-3 [animation-delay:300ms] sm:flex-row sm:justify-center lg:justify-start">
              <Button asChild size="lg" className="group h-12 rounded-full px-8 text-base">
                <Link href="/auth">
                  เข้าสู่ระบบ <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full bg-card/60 px-8 text-base backdrop-blur">
                <a href="#features">ดูฟีเจอร์</a>
              </Button>
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* Ticker */}
      <div className="overflow-hidden border-y bg-card py-4" aria-hidden>
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i} className="flex items-center gap-10 text-sm font-medium text-muted-foreground">
              {t} <span className="size-1.5 rounded-full bg-primary/60" />
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-16 sm:px-6 md:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 100} className="text-center">
            <p className="bg-linear-to-br from-[#7c5ce6] to-[#f0457f] bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
              <CountUp to={s.to} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
          </Reveal>
        ))}
      </section>

      {/* Features */}
      <section className="scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionHead id="features" kicker="ฟีเจอร์" title="ทุกอย่างที่งานครุภัณฑ์ต้องใช้" text="ออกแบบให้ใช้งานง่ายทั้งบนคอมพิวเตอร์ แท็บเล็ต และมือถือ" />
        <div className="mx-auto mt-14 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 100}>
              <div className="group h-full rounded-3xl border bg-card p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10">
                <GradientIcon icon={f.icon} tone={f.tone} className="size-12 rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" iconClass="size-6" />
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="scroll-mt-20 bg-muted/50 px-4 py-20 sm:px-6">
        <SectionHead id="workflow" kicker="ขั้นตอนการทำงาน" title="จากลงทะเบียนถึงรายงาน ใน 4 ขั้นตอน" />
        <ol className="relative mx-auto mt-14 grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-0 right-0 top-9 z-0 hidden h-px bg-linear-to-r from-transparent via-primary/40 to-transparent lg:block" />
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <li className="relative h-full list-none rounded-3xl border bg-card p-7">
                <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-[#7c5ce6] to-[#a07bff] text-lg font-bold text-white shadow-lg shadow-primary/30">
                  {s.n}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Modules */}
      <section className="scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionHead id="modules" kicker="โมดูล" title="ครบทุกโมดูลในระบบเดียว" text="เลือกใช้ตามสิทธิ์ของแต่ละบทบาท: ผู้ดูแลระบบ ผู้จัดการ ช่าง ผู้ตรวจนับ และผู้ใช้ทั่วไป" />
        <div className="mx-auto mt-14 grid max-w-7xl grid-cols-2 gap-4 md:grid-cols-4">
          {modules.map((m, i) => (
            <Reveal key={m.title} delay={(i % 4) * 80}>
              <div className="flex h-full flex-col items-center rounded-3xl border bg-card p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
                <GradientIcon icon={m.icon} tone={m.tone} className="size-12 rounded-2xl" iconClass="size-6" />
                <h3 className="mt-4 font-semibold">{m.title}</h3>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{m.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 3D Office */}
      <section className="scroll-mt-20 px-4 pb-20 sm:px-6">
        <Reveal>
          <div id="office-3d" className="relative mx-auto max-w-7xl scroll-mt-24 overflow-hidden rounded-[40px] bg-linear-to-br from-[#2a1d5e] via-[#3b2a85] to-[#6a4bd8] p-8 text-white sm:p-14">
            <div className="pointer-events-none absolute -right-16 -top-16 size-72 animate-float rounded-full bg-pink-400/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 size-72 animate-float rounded-full bg-orange-300/20 blur-3xl [animation-delay:-3s]" />
            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold tracking-wide text-orange-200">3D Office</p>
                <h2 className="mt-3 text-3xl font-bold leading-snug sm:text-4xl">เห็นการทำงานจริงในสำนักงานเสมือน</h2>
                <p className="mt-4 leading-8 text-white/80">
                  ตัวละครในสำนักงาน 3D ทำงานตามเหตุการณ์จริงของระบบ แจ้งซ่อม → Helpdesk → ช่างรับงาน → ซ่อม → ปิดงาน
                  ดูภาพรวมงานของทีมได้อย่างเข้าใจง่าย
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3" aria-hidden>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ animationDelay: `${-i * 0.7}s` }}
                    className="aspect-square animate-float rounded-2xl border border-white/20 bg-white/10 backdrop-blur"
                  >
                    <div className="flex size-full items-center justify-center">
                      <Box className="size-1/2 text-white/70" strokeWidth={1.5} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold leading-snug sm:text-4xl">พร้อมเริ่มต้นใช้งานแล้วหรือยัง?</h2>
          <p className="mt-4 text-muted-foreground">เข้าสู่ระบบด้วยบัญชีที่ผู้ดูแลระบบมอบให้</p>
          <Button asChild size="lg" className="group mt-8 h-12 rounded-full px-10 text-base">
            <Link href="/auth">
              เข้าสู่ระบบ <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </Reveal>
      </section>

      <footer className="border-t px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
        Assets Management System · พัฒนาโดย Tinnakorn Siripong · © 2569
      </footer>
    </div>
  );
}

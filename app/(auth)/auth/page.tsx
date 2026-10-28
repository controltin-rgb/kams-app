import type { Metadata } from "next";
import {
  ArrowLeftRight,
  BarChart3,
  Blocks,
  Headset,
  MonitorSmartphone,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { GradientIcon, type Tone } from "@/components/gradient-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SigninForm } from "./signin-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ | AMS" };

const features: { icon: LucideIcon; tone: Tone; text: string }[] = [
  { icon: MonitorSmartphone, tone: "orange", text: "ทะเบียนครุภัณฑ์ + Asset Bundle + QR/Barcode" },
  { icon: Headset, tone: "pink", text: "Helpdesk พร้อม SLA และคลังความรู้" },
  { icon: Wrench, tone: "violet", text: "ส่งซ่อม เคลมประกัน และเครื่องสำรองอัตโนมัติ" },
  { icon: ArrowLeftRight, tone: "green", text: "ยืม-คืน พร้อมขั้นตอนอนุมัติ" },
  { icon: BarChart3, tone: "blue", text: "รายงานและแดชบอร์ดเชิงวิเคราะห์" },
];

export default function AuthPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-auth p-4 sm:p-8">
      <ThemeToggle className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6" />
      <div className="pointer-events-none absolute -left-20 bottom-0 size-96 animate-float rounded-full bg-emerald-200/40 blob blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-0 size-96 animate-float rounded-full bg-pink-200/40 blob blur-3xl [animation-delay:-4s]" />

      <div className="relative grid w-full max-w-360 animate-fade-up overflow-hidden rounded-[40px] bg-card shadow-2xl shadow-black/10 dark:shadow-black/40 lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden overflow-hidden bg-auth-panel p-16 lg:block">
          <div className="absolute -top-24 right-0 size-75 animate-float rounded-full bg-orange-200/60 blob" />
          <div className="absolute -bottom-16 -left-16 size-72 animate-float rounded-full bg-pink-200/60 blob [animation-delay:-3s]" />
          <div className="relative">
            <GradientIcon icon={Blocks} tone="orange" className="size-21 animate-pop rounded-3xl" iconClass="size-10" />
            <h1 className="mt-14 animate-fade-up text-[40px] font-bold leading-[1.45] [animation-delay:100ms]">
              ระบบจัดการครุภัณฑ์
              <br />
              และอุปกรณ์ไอที
            </h1>
            <p className="mt-6 max-w-lg animate-fade-up text-lg leading-8 text-muted-foreground [animation-delay:200ms]">
              ระบบบริหารจัดการครุภัณฑ์อุปกรณ์ครบวงจร ตั้งแต่ลงทะเบียน คลัง แจ้งซ่อม ยืม-คืน จนถึงจำหน่าย
            </p>
            <ul className="mt-6 space-y-5">
              {features.map((f, i) => (
                <li
                  key={f.text}
                  className="flex animate-slide-in items-center gap-4 text-[17px] text-foreground/80"
                  style={{ animationDelay: `${300 + i * 90}ms` }}
                >
                  <GradientIcon icon={f.icon} tone={f.tone} className="size-12.75 rounded-2xl" iconClass="size-6" />
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex items-center p-6 sm:p-16">
          <div className="mx-auto w-full max-w-142.5 animate-fade-up [animation-delay:150ms]">
            <GradientIcon icon={Blocks} tone="orange" className="size-21 rounded-3xl" iconClass="size-10" />
            <h2 className="mt-9 text-2xl font-bold sm:text-[34px]">Assets Management System</h2>
            <p className="mt-3 text-muted-foreground">พัฒนาโดย Tinnakorn Siripong · หน่วยงานของคุณ</p>
            <SigninForm />
            <p className="mt-8 text-center text-sm text-muted-foreground">Version 1.3.0 · © 2569</p>
          </div>
        </section>
      </div>
    </main>
  );
}

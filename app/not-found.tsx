import Link from "next/link";
import { SearchX } from "lucide-react";
import { GradientIcon } from "@/components/gradient-icon";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <GradientIcon icon={SearchX} tone="blue" className="size-20 animate-pop rounded-3xl" iconClass="size-10" />
      <h1 className="mt-6 animate-fade-up text-2xl font-semibold">ไม่พบข้อมูลที่ต้องการ</h1>
      <p className="mt-2 animate-fade-up text-muted-foreground [animation-delay:80ms]">ข้อมูลอาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
      <Link
        href="/dashboard"
        className="mt-6 animate-fade-up rounded-xl bg-brand px-6 py-3 font-semibold text-white transition hover:-translate-y-0.5 [animation-delay:160ms]"
      >
        กลับหน้า Dashboard
      </Link>
    </main>
  );
}

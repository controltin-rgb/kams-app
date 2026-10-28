"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock, Printer, Search } from "lucide-react";
import { GradientIcon } from "@/components/gradient-icon";
import { manual, type ManualSection, type ManualTopic } from "@/modules/manual/content";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-full bg-card px-5 py-3 font-semibold shadow-sm transition hover:bg-muted"
    >
      <Printer className="size-4" /> พิมพ์คู่มือ
    </button>
  );
}

const topicText = (t: ManualTopic) => [t.title, ...(t.steps ?? []), ...(t.tips ?? [])].join(" ");

/** Sections (and within them, topics) matching the search; a matching section title keeps all its topics. */
function search(sections: ManualSection[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((s) => {
      if (`${s.title} ${s.summary}`.toLowerCase().includes(q)) return s;
      const topics = s.topics.filter((t) => topicText(t).toLowerCase().includes(q));
      return topics.length ? { ...s, topics } : null;
    })
    .filter((s): s is ManualSection => s !== null);
}

function Topic({ topic }: { topic: ManualTopic }) {
  return (
    <div className="break-inside-avoid space-y-2">
      <h3 className="font-semibold">{topic.title}</h3>
      {topic.steps && (
        <ol className="space-y-1.5 text-sm">
          {topic.steps.map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {topic.tips && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {topic.tips.map((tip, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({ section, canUse }: { section: ManualSection; canUse: boolean }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28 animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6 print:break-inside-avoid print:p-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <GradientIcon icon={section.icon} tone={section.tone} className="size-11 rounded-xl print:hidden" iconClass="size-5" />
          <div className="min-w-0">
            <h2 id={`${section.id}-title`} className="text-lg font-semibold">
              {section.title}
            </h2>
            <p className="text-sm text-muted-foreground">{section.summary}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {canUse ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> คุณใช้งานได้
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              <Lock className="size-3.5" /> ต้องมีสิทธิ์เพิ่มเติม
            </span>
          )}
          {canUse && section.href && (
            <Link href={section.href} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold transition hover:bg-muted/70">
              ไปที่หน้านี้ <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">ผู้ใช้หลัก: {section.who}</p>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {section.topics.map((t) => (
          <Topic key={t.title} topic={t} />
        ))}
      </div>
    </section>
  );
}

/** The guide: search, a contents list, and every module's how-to (only the ones this person can use, unless asked). */
export function ManualView({ allowed }: { allowed: string[] }) {
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(true);
  const can = useMemo(() => new Set(allowed), [allowed]);
  const shown = useMemo(() => search(onlyMine ? manual.filter((s) => can.has(s.id)) : manual, query), [onlyMine, can, query]);

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] print:block print:space-y-6">
      <h1 className="hidden text-2xl font-semibold print:block">คู่มือการใช้งานระบบ</h1>
      <aside className="space-y-3 print:hidden lg:sticky lg:top-28 lg:self-start">
        <label className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm shadow-black/4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาในคู่มือ..."
            aria-label="ค้นหาในคู่มือ"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 px-1 text-sm">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="size-4 accent-brand" />
          แสดงเฉพาะเมนูที่ฉันใช้ได้
        </label>
        <nav aria-label="สารบัญคู่มือ" className="rounded-2xl bg-card p-2 shadow-sm shadow-black/4">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {shown.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-muted">
                  <s.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 space-y-6">
        {shown.length ? (
          shown.map((s) => <Section key={s.id} section={s} canUse={can.has(s.id)} />)
        ) : (
          <p className="rounded-[28px] bg-card p-6 text-center text-muted-foreground shadow-sm">ไม่พบหัวข้อที่ตรงกับ &quot;{query}&quot;</p>
        )}
      </div>
    </div>
  );
}

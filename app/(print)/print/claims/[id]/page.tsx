import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { claimStatusLabels } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { getClaim } from "@/modules/claims/queries";
import { PrintButton } from "../../print-button";

export const metadata: Metadata = { title: "ใบส่งเคลม | AMS" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-dotted border-neutral-400 py-1">
      <span className="w-28 shrink-0 text-neutral-600">{label}</span>
      <span className="min-w-0 flex-1 font-medium">{children || "-"}</span>
    </div>
  );
}

async function Sheet({ params }: { params: PageProps<"/print/claims/[id]">["params"] }) {
  await requirePermission("claim", "view");
  const { id } = await params;
  const [c, settings] = await Promise.all([getClaim(id), getSettings()]);
  if (!c) notFound();
  const warrantyOk = c.asset.warrantyExpiry ? c.asset.warrantyExpiry.toISOString().slice(0, 10) >= c.sentDate : null;

  return (
    <article className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[15mm] text-[12px] leading-relaxed shadow-xl print:min-h-0 print:w-auto print:p-0 print:shadow-none">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-[11px] text-neutral-600">Assets Management System · {settings["org.name"]}</p>
          <h1 className="text-2xl font-bold">ใบส่งเคลม / ส่งซ่อม</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold">{c.claimNumber}</p>
          <p>วันที่ส่ง {formatDate(c.sentDate)}</p>
          <p>สถานะ: {claimStatusLabels[c.status]}</p>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
        <section>
          <h2 className="mb-1.5 border-b-2 border-black pb-0.5 text-[13px] font-bold">ถึง (ผู้ขาย / ศูนย์บริการ)</h2>
          <Row label="ชื่อ">{c.vendor.name}</Row>
          <Row label="ผู้ติดต่อ">{c.vendor.contact}</Row>
          <Row label="โทรศัพท์">{c.vendor.phone}</Row>
          <Row label="ที่อยู่">{c.vendor.address}</Row>
        </section>
        <section>
          <h2 className="mb-1.5 border-b-2 border-black pb-0.5 text-[13px] font-bold">อุปกรณ์</h2>
          <Row label="รหัสครุภัณฑ์">
            <span className="font-mono">{c.asset.assetCode}</span>
          </Row>
          <Row label="รายการ">{c.asset.name}</Row>
          <Row label="ยี่ห้อ / รุ่น">{[c.asset.brand, c.asset.model].filter(Boolean).join(" ")}</Row>
          <Row label="Serial">{c.oldSerial ?? c.asset.serialNumber}</Row>
          <Row label="ประกัน">{c.asset.warrantyExpiry ? `${formatDate(c.asset.warrantyExpiry)} (${warrantyOk ? "ในประกัน" : "หมดประกัน"})` : "-"}</Row>
        </section>
      </div>

      <section className="mt-4">
        <h2 className="mb-1.5 border-b-2 border-black pb-0.5 text-[13px] font-bold">อาการ / ปัญหา</h2>
        <p className="min-h-20 whitespace-pre-line">{c.problem}</p>
        {c.notes && <p className="mt-2 whitespace-pre-line text-neutral-700">หมายเหตุ: {c.notes}</p>}
        <Row label="คาดว่าได้คืน">{formatDate(c.expectedReturnDate, "")}</Row>
        {c.ticket && <Row label="อ้างอิงงานซ่อม">{c.ticket.ticketNumber}</Row>}
      </section>

      <footer className="mt-14 grid break-inside-avoid grid-cols-2 gap-10 text-center">
        {[
          ["ผู้ส่ง", c.createdByName],
          ["ผู้รับ (ผู้ขาย / ศูนย์บริการ)", null],
        ].map(([role, name]) => (
          <div key={role}>
            <div className="h-12 border-b border-dotted border-black" />
            <p className="mt-1">( {name ?? "........................................"} )</p>
            <p className="font-semibold">{role}</p>
            <p className="text-neutral-600">วันที่ ......../......../........</p>
          </div>
        ))}
      </footer>
      <p className="mt-6 text-right text-[10px] text-neutral-500">พิมพ์เมื่อ {formatDateTime(new Date())}</p>
    </article>
  );
}

export default function PrintClaimPage({ params }: PageProps<"/print/claims/[id]">) {
  return (
    <>
      <style>{`@page { size: A4; margin: 15mm; }`}</style>
      <PrintButton />
      <Suspense fallback={<p className="text-center">กำลังโหลด...</p>}>
        <Sheet params={params} />
      </Suspense>
    </>
  );
}

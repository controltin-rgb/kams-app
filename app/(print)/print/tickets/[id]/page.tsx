import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { assetStatusLabels, ticketCategoryLabels, ticketPriorityLabels, ticketSourceLabels, ticketStatusLabels } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { getTicket } from "@/modules/tickets/queries";
import { PrintButton } from "../../print-button";

export const metadata: Metadata = { title: "ใบแจ้งซ่อม | AMS" };

const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-dotted border-neutral-400 py-1">
      <span className="w-28 shrink-0 text-neutral-600">{label}</span>
      <span className="min-w-0 flex-1 font-medium">{children || "-"}</span>
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-1.5 border-b-2 border-black pb-0.5 text-[13px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

async function TicketSheet({ params }: { params: PageProps<"/print/tickets/[id]">["params"] }) {
  const session = await requirePermission("ticket", "view");
  const { id } = await params;
  const orgName = (await getSettings())["org.name"];
  const t = await getTicket(id, { id: session.user.id, role: session.user.role });
  if (!t) notFound();

  const reporter = t.reporter?.name ?? t.reporterName ?? "-";
  const contact = t.reporter ? [t.reporter.phone, t.reporter.email].filter(Boolean).join(" / ") : t.reporterContact;

  return (
    <article className="mx-auto w-[210mm] min-h-[297mm] bg-white p-[15mm] text-[12px] leading-relaxed shadow-xl print:min-h-0 print:w-auto print:p-0 print:shadow-none">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-[11px] text-neutral-600">Assets Management System · {orgName}</p>
          <h1 className="text-2xl font-bold">ใบแจ้งซ่อม</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold">{t.ticketNumber}</p>
          <p>วันที่แจ้ง {formatDate(t.createdAt)}</p>
          <p>สถานะ: {ticketStatusLabels[t.status]}</p>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
        <Box title="ผู้แจ้ง">
          <Row label="ชื่อ">{reporter}</Row>
          <Row label="ติดต่อ">{contact}</Row>
          <Row label="ช่องทาง">{ticketSourceLabels[t.source]}</Row>
          <Row label="สถานที่">{t.locationText}</Row>
        </Box>
        <Box title="ข้อมูลงาน">
          <Row label="หมวด">{ticketCategoryLabels[t.category]}</Row>
          <Row label="ความเร่งด่วน">{ticketPriorityLabels[t.priority]}</Row>
          <Row label="กำหนดเสร็จ">{formatDateTime(t.dueAt)}</Row>
          <Row label="ผู้รับผิดชอบ">{t.assignedTech?.name}</Row>
        </Box>
      </div>

      <div className="mt-4 space-y-4">
        <Box title="ครุภัณฑ์">
          {t.asset ? (
            <div className="grid grid-cols-2 gap-x-8">
              <Row label="รหัส">
                <span className="font-mono">{t.asset.assetCode}</span>
              </Row>
              <Row label="ชื่อ">{t.asset.name}</Row>
              <Row label="สถานะปัจจุบัน">{assetStatusLabels[t.asset.status]}</Row>
              <Row label="ใช้งานไม่ได้">{t.assetUnusable ? "ใช่" : "ไม่"}</Row>
            </div>
          ) : (
            <p className="text-neutral-600">ไม่ระบุครุภัณฑ์</p>
          )}
        </Box>

        <Box title="อาการ / ปัญหา">
          <p className="font-semibold">{t.title}</p>
          <p className="min-h-16 whitespace-pre-line">{t.description}</p>
        </Box>

        <Box title="ผลการตรวจซ่อม">
          <Row label="สาเหตุ">{t.cause}</Row>
          <Row label="วิธีแก้ไข">{t.resolution}</Row>
          <Row label="เสร็จเมื่อ">{formatDateTime(t.resolvedAt, "")}</Row>
        </Box>

        <Box title="อะไหล่และค่าใช้จ่าย">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="[&>th]:border [&>th]:border-neutral-500 [&>th]:px-2 [&>th]:py-1">
                <th className="w-8">#</th>
                <th className="text-left">รายการ</th>
                <th className="w-16 text-right">จำนวน</th>
                <th className="w-24 text-right">ราคา/หน่วย</th>
                <th className="w-24 text-right">รวม</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border [&_td]:border-neutral-500 [&_td]:px-2 [&_td]:py-1">
              {t.parts.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-center">{i + 1}</td>
                  <td>{p.name}</td>
                  <td className="text-right">{p.qty}</td>
                  <td className="text-right">{money.format(Number(p.unitCost))}</td>
                  <td className="text-right">{money.format(Number(p.total))}</td>
                </tr>
              ))}
              {t.parts.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-500">
                    -
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="text-right">
                  ค่าแรง/ค่าบริการ
                </td>
                <td className="text-right">{money.format(Number(t.laborCost))}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={4} className="text-right">
                  รวมทั้งสิ้น (บาท)
                </td>
                <td className="text-right">{money.format(Number(t.repairCost))}</td>
              </tr>
            </tbody>
          </table>
        </Box>
      </div>

      <footer className="mt-12 grid break-inside-avoid grid-cols-3 gap-6 text-center">
        {["ผู้แจ้ง", "ผู้ซ่อม/ผู้รับผิดชอบ", "ผู้ตรวจรับ/ผู้อนุมัติ"].map((role) => (
          <div key={role}>
            <div className="h-12 border-b border-dotted border-black" />
            <p className="mt-1">( ........................................ )</p>
            <p className="font-semibold">{role}</p>
            <p className="text-neutral-600">วันที่ ......../......../........</p>
          </div>
        ))}
      </footer>
      <p className="mt-6 text-right text-[10px] text-neutral-500">พิมพ์เมื่อ {formatDateTime(new Date())}</p>
    </article>
  );
}

export default function PrintTicketPage({ params }: PageProps<"/print/tickets/[id]">) {
  return (
    <>
      <style>{`@page { size: A4; margin: 15mm; }`}</style>
      <PrintButton />
      <Suspense fallback={<p className="text-center">กำลังโหลด...</p>}>
        <TicketSheet params={params} />
      </Suspense>
    </>
  );
}

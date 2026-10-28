import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { assetStatusLabels, transferItemActionLabels, transferTypeLabels } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { getTransfer } from "@/modules/deployments/queries";
import { PrintButton } from "../../print-button";

export const metadata: Metadata = { title: "เอกสารส่งมอบ | AMS" };

const titles = {
  HANDOVER: "ใบส่งมอบครุภัณฑ์",
  RETURN: "ใบรับคืนครุภัณฑ์",
  MOVE: "ใบย้ายครุภัณฑ์",
  SWAP_PARTIAL: "ใบเปลี่ยนเครื่อง / ชิ้นส่วน",
  SWAP_FULL: "ใบเปลี่ยนเครื่อง (ทั้งชุด)",
} as const;

async function Sheet({ params }: { params: PageProps<"/print/transfers/[id]">["params"] }) {
  await requirePermission("deployment", "view");
  const { id } = await params;
  const orgName = (await getSettings())["org.name"];
  const t = await getTransfer(id);
  if (!t) notFound();

  return (
    <article className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[15mm] text-[12px] leading-relaxed shadow-xl print:min-h-0 print:w-auto print:p-0 print:shadow-none">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-[11px] text-neutral-600">Assets Management System · {orgName}</p>
          <h1 className="text-2xl font-bold">{titles[t.type]}</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold">{t.docNumber}</p>
          <p>วันที่ {formatDate(t.createdAt)}</p>
          <p>{transferTypeLabels[t.type]}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
        {(
          [
            ["ผู้รับ", t.toOwnerName],
            ["แผนก", t.toDepartmentName],
            ["สถานที่", t.toLocationPath],
            ["งานแจ้งซ่อม", t.ticket?.ticketNumber],
            ["ผู้ทำรายการ", t.performedByName],
            ["เหตุผล", t.reason],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex gap-2 border-b border-dotted border-neutral-400 py-1">
            <span className="w-24 shrink-0 text-neutral-600">{label}</span>
            <span className="font-medium">{value || "-"}</span>
          </div>
        ))}
      </section>

      <table className="mt-5 w-full border-collapse text-[11px]">
        <thead>
          <tr className="[&>th]:border [&>th]:border-neutral-500 [&>th]:px-2 [&>th]:py-1 [&>th]:text-left">
            <th className="w-8 text-center!">#</th>
            <th>รหัส</th>
            <th>รายการ / ยี่ห้อ-รุ่น / Serial</th>
            <th>การดำเนินการ</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody className="[&_td]:border [&_td]:border-neutral-500 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top">
          {t.items.map((i, n) => (
            <tr key={i.id}>
              <td className="text-center">{n + 1}</td>
              <td className="font-mono">{i.asset.assetCode}</td>
              <td>
                {i.asset.name}
                <div className="text-neutral-600">
                  {[i.asset.brand, i.asset.model].filter(Boolean).join(" ")}
                  {i.asset.serialNumber && ` · S/N ${i.asset.serialNumber}`}
                </div>
              </td>
              <td>{transferItemActionLabels[i.action]}</td>
              <td>{i.toStatus ? assetStatusLabels[i.toStatus] : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-neutral-700">ข้าพเจ้าได้ตรวจสอบและรับ/ส่งมอบครุภัณฑ์ตามรายการข้างต้นในสภาพเรียบร้อย</p>

      <footer className="mt-10 grid break-inside-avoid grid-cols-2 gap-10 text-center">
        <div>
          <div className="flex h-20 items-end justify-center border-b border-dotted border-black">
            {t.signatureId && (
              // eslint-disable-next-line @next/next/no-img-element -- served by the authorised file route
              <img src={`/api/files/${t.signatureId}`} alt="ลายเซ็นผู้รับ" className="max-h-20" />
            )}
          </div>
          <p className="mt-1">( {t.signedByName ?? "........................................"} )</p>
          <p className="font-semibold">ผู้รับ</p>
          <p className="text-neutral-600">{t.signedAt ? `วันที่ ${formatDate(t.signedAt)}` : "วันที่ ......../......../........"}</p>
        </div>
        <div>
          <div className="h-20 border-b border-dotted border-black" />
          <p className="mt-1">( {t.performedByName ?? "........................................"} )</p>
          <p className="font-semibold">ผู้ส่งมอบ / เจ้าหน้าที่</p>
          <p className="text-neutral-600">วันที่ {formatDate(t.createdAt)}</p>
        </div>
      </footer>
      <p className="mt-6 text-right text-[10px] text-neutral-500">พิมพ์เมื่อ {formatDateTime(new Date())}</p>
    </article>
  );
}

export default function PrintTransferPage({ params }: PageProps<"/print/transfers/[id]">) {
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

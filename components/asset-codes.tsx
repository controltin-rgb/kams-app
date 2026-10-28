"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Public scan URL encoded in QR codes (no sensitive data — see CLAUDE.md §8). */
export function assetScanPath(assetCode: string) {
  return `/a/${encodeURIComponent(assetCode)}`;
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

/** Code128 barcode of the asset code + QR code linking to the public scan page. */
export function AssetCodes({ assetCode }: { assetCode: string }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [qr, setQr] = useState<{ svg: string; png: string; url: string } | null>(null);

  useEffect(() => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, assetCode, {
        format: "CODE128",
        height: 56,
        width: 1.8,
        fontSize: 14,
        margin: 8,
        background: "#ffffff",
        lineColor: "#000000",
      });
    }
    const url = `${window.location.origin}${assetScanPath(assetCode)}`;
    Promise.all([
      QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
      QRCode.toDataURL(url, { margin: 1, width: 512, errorCorrectionLevel: "M" }),
    ]).then(([svg, png]) => setQr({ svg, png, url }));
  }, [assetCode]);

  const downloadBarcode = () => {
    if (!barcodeRef.current) return;
    const blob = new Blob([new XMLSerializer().serializeToString(barcodeRef.current)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `${assetCode}-barcode.svg`);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="mx-auto w-36 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
        {qr ? (
          // SVG markup is generated locally by the qrcode library from our own URL
          <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
        ) : (
          <div className="aspect-square animate-pulse rounded-xl bg-muted" />
        )}
      </div>
      <div className="min-w-0 space-y-3">
        <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
          <svg ref={barcodeRef} className="mx-auto h-auto max-w-full" role="img" aria-label={`บาร์โค้ด ${assetCode}`} />
        </div>
        {qr && <p className="truncate text-xs text-muted-foreground">QR: {qr.url}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" disabled={!qr} onClick={() => qr && downloadUrl(qr.png, `${assetCode}-qr.png`)}>
            <Download /> QR (PNG)
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={downloadBarcode}>
            <Download /> Barcode (SVG)
          </Button>
        </div>
      </div>
    </div>
  );
}

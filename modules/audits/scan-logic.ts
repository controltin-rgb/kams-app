import type { AuditResult } from "@/generated/prisma/enums";

// Client-safe helpers shared by the offline scan page and the sync endpoint.

/**
 * Normalise what a scanner returns: QR codes contain the public URL `/a/{assetCode}`,
 * Code128 barcodes and keyboard input contain the code itself.
 */
export function parseScannedCode(raw: string): string {
  const text = raw.trim();
  const m = text.match(/\/a\/([^/?#\s]+)/);
  const code = m ? m[1] : text;
  try {
    return decodeURIComponent(code).trim();
  } catch {
    return code;
  }
}

export type LookupAsset = { id: string; assetCode: string; barcode: string | null; locationId: string | null };

/** Find an asset by its code (case-insensitive) or manufacturer barcode. */
export function findAsset<T extends LookupAsset>(assets: T[], code: string): T | undefined {
  const c = code.toUpperCase();
  return assets.find((a) => a.assetCode.toUpperCase() === c) ?? assets.find((a) => a.barcode === code);
}

/** CLAUDE.md §8: not in the register → UNREGISTERED, location differs → RELOCATED, otherwise MATCHED. */
export function classifyScan(asset: Pick<LookupAsset, "locationId"> | undefined, actualLocationId: string | null): AuditResult {
  if (!asset) return "UNREGISTERED";
  if (actualLocationId && asset.locationId !== actualLocationId) return "RELOCATED";
  return "MATCHED";
}

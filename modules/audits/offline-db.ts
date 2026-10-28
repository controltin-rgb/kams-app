"use client";

import Dexie, { type EntityTable } from "dexie";
import type { AuditResult, AssetCondition } from "@/generated/prisma/enums";
import type { ScanPack } from "./queries";

/** One scan waiting on (or done with) upload. Kept on the device so scanning works without a connection. */
export type QueuedScan = {
  clientUuid: string;
  campaignId: string;
  code: string;
  actualLocationId: string | null;
  condition: AssetCondition;
  notes?: string;
  scannedAt: string;
  /** Offline classification shown to the auditor right away */
  localResult: AuditResult;
  assetCode?: string;
  assetName?: string;
  sync: "pending" | "synced" | "rejected";
  message?: string;
};

type StoredPack = { campaignId: string; pack: ScanPack; savedAt: string };

type StockTakeDb = Dexie & {
  packs: EntityTable<StoredPack, "campaignId">;
  scans: EntityTable<QueuedScan, "clientUuid">;
};

let db: StockTakeDb | null = null;

export function stockTakeDb(): StockTakeDb {
  if (!db) {
    db = new Dexie("ams-stock-take") as StockTakeDb;
    db.version(1).stores({ packs: "campaignId", scans: "clientUuid, campaignId, [campaignId+sync]" });
  }
  return db;
}

/** RFC 4122 v4 — crypto.randomUUID is missing on plain-http LAN addresses, so fall back to getRandomValues. */
export function newUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

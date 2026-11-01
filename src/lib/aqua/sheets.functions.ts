import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SheetReading } from "./rules";
import { sheets as sheetsCfg } from "./config";

/**
 * Google Sheets is the only store for sensor data. The web talks to it through the
 * Google Apps Script Web App in /integrations/google-apps-script/Code.gs.
 * URL (and optional token) are set in src/lib/aqua/config.ts; the env vars
 * GOOGLE_SHEETS_WEBAPP_URL / SHEETS_API_TOKEN still work as a fallback.
 */

export type TelemetryResponse = {
  configured: boolean;
  ok: boolean;
  message: string;
  rows: SheetReading[]; // oldest first
  total: number; // data rows in the sheet (excluding header)
  offset: number;
  nextOffset: number; // offset to request next time
  complete: boolean; // false when the page cap was reached before the end of the sheet
  checkedAt: string;
};

const PAGE = 1000;
const MAX_PAGES = 200; // 200k rows per call; the client asks again for the rest

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toReading(r: any): SheetReading | null {
  const row = Number(r.row);
  const ph = Number(r.ph);
  const tds = Number(r.tds);
  const temperature = Number(r.temperature ?? r.suhu);
  const ts = r.timestamp ? new Date(String(r.timestamp)) : null;
  if (!Number.isInteger(row) || row < 2) return null;
  if (!ts || Number.isNaN(ts.getTime()) || [ph, tds, temperature].some((n) => !Number.isFinite(n))) return null;
  return { row, timestamp: ts.toISOString(), ph, tds, temperature };
}

function config() {
  const url = (sheetsCfg.url || process.env["GOOGLE_SHEETS_WEBAPP_URL"] || "").trim();
  const token = (sheetsCfg.token || process.env["SHEETS_API_TOKEN"] || "").trim();
  return url ? { url, token } : null;
}

async function callScript(url: string, init?: RequestInit, timeoutMs = 25000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
    const text = await res.text();
    if (!res.ok) throw new Error(`Google Apps Script merespon status ${res.status}.`);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Respons Google Apps Script bukan JSON yang valid. Periksa deployment Web App (akses: Anyone).");
    }
    if (!json || typeof json !== "object") throw new Error("Respons Google Apps Script tidak valid.");
    const obj = json as any;
    if (obj.ok === false) throw new Error(String(obj.error ?? "Google Apps Script menolak permintaan."));
    return obj;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Google Sheets melebihi batas waktu.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const getTelemetry = createServerFn({ method: "GET" })
  .inputValidator((d: { offset?: number }) => z.object({ offset: z.number().int().min(0).optional() }).parse(d))
  .handler(async ({ data }): Promise<TelemetryResponse> => {
    const checkedAt = new Date().toISOString();
    const offset = data.offset ?? 0;
    const cfg = config();
    if (!cfg)
      return { configured: false, ok: false, message: "Google Sheets belum dihubungkan (isi sheets.url di src/lib/aqua/config.ts).", rows: [], total: 0, offset, nextOffset: offset, complete: false, checkedAt };
    const rows: SheetReading[] = [];
    let total = 0;
    let cursor = offset;
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const u = new URL(cfg.url);
        u.searchParams.set("action", "history");
        u.searchParams.set("offset", String(cursor));
        u.searchParams.set("limit", String(PAGE));
        if (cfg.token) u.searchParams.set("token", cfg.token);
        const json = await callScript(u.toString());
        total = Number(json.total ?? 0);
        const list = Array.isArray(json.rows) ? (json.rows as Record<string, unknown>[]) : [];
        for (const r of list) {
          const v = toReading(r);
          if (v) rows.push(v);
        }
        cursor += list.length;
        if (!list.length || cursor >= total) break;
      }
      rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.row - b.row);
      return {
        configured: true,
        ok: true,
        message: total ? "Google Sheets terhubung." : "Google Sheets terhubung, belum ada data.",
        rows,
        total,
        offset,
        nextOffset: cursor,
        complete: cursor >= total,
        checkedAt,
      };
    } catch (e) {
      return { configured: true, ok: false, message: (e as Error).message || "Gagal menghubungi Google Sheets.", rows: [], total: 0, offset, nextOffset: offset, complete: false, checkedAt };
    }
  });

export type DeleteResponse = { ok: boolean; message: string; deleted: number; skipped: number };

const itemSchema = z.object({ row: z.number().int().min(2), timestamp: z.string().min(10).max(40) });

export const deleteSheetRows = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        mode: z.enum(["rows", "range"]),
        items: z.array(itemSchema).max(20000).optional(),
        from: z.string().max(40).optional(),
        to: z.string().max(40).optional(),
      })
      .refine((v) => (v.mode === "rows" ? !!v.items?.length : !!v.from && !!v.to), "Pilihan data yang dihapus tidak lengkap.")
      .parse(d),
  )
  .handler(async ({ data }): Promise<DeleteResponse> => {
    const cfg = config();
    if (!cfg) return { ok: false, message: "Google Sheets belum dihubungkan.", deleted: 0, skipped: 0 };
    if (data.mode === "range" && new Date(data.from!).getTime() > new Date(data.to!).getTime())
      return { ok: false, message: "Tanggal awal harus sebelum tanggal akhir.", deleted: 0, skipped: 0 };
    const body =
      data.mode === "rows"
        ? { action: "delete", token: cfg.token, items: data.items }
        : { action: "deleteRange", token: cfg.token, from: new Date(data.from!).toISOString(), to: new Date(data.to!).toISOString() };
    try {
      const json = await callScript(cfg.url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) }, 55000);
      const deleted = Number(json.deleted ?? 0);
      const skipped = Number(json.skipped ?? 0);
      return {
        ok: true,
        deleted,
        skipped,
        message: skipped
          ? `${deleted} baris dihapus dari Google Sheets. ${skipped} baris dilewati karena isinya sudah berubah.`
          : `${deleted} baris dihapus dari Google Sheets.`,
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message || "Gagal menghapus data.", deleted: 0, skipped: 0 };
    }
  });

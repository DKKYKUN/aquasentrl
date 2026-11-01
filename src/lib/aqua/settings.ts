import { z } from "zod";
import { supabase } from "./config";
import type { Settings } from "./rules";

/**
 * Pengaturan aplikasi disimpan di tabel public.app_settings pada Supabase milik pengguna
 * (lihat /integrations/supabase/app_settings.sql). Browser langsung memakai anon key dari config.ts.
 */

export const settingsSchema = z.object({
  pollInterval: z.number().int().min(2000).max(3_600_000),
  phMin: z.number().min(0).max(14),
  phMax: z.number().min(0).max(14),
  tdsMax: z.number().min(0).max(100000),
  tempMin: z.number().min(-10).max(100),
  tempMax: z.number().min(-10).max(100),
  staleThresholdSec: z.number().int().min(10).max(86400),
});

export type SettingsResponse = {
  configured: boolean;
  ok: boolean;
  message: string;
  settings: { [K in keyof Settings]?: Settings[K] | undefined } | null;
  updatedAt: string | null;
};

function cfg() {
  const url = supabase.url.trim();
  const key = supabase.apikey.trim();
  if (!url || !key) return null;
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
  // Key lama (JWT) wajib juga dikirim sebagai Bearer; key baru "sb_publishable_…" tidak.
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;
  return { base: `${url.replace(/\/$/, "")}/rest/v1/app_settings`, headers };
}

function httpHint(status: number, body: string): string {
  if (status === 404 || /PGRST205|app_settings/.test(body)) return "Tabel app_settings belum dibuat. Jalankan integrations/supabase/app_settings.sql di SQL Editor Supabase.";
  if (status === 401 || status === 403 || /42501|permission denied|row-level security/i.test(body))
    return "Supabase menolak akses. Jalankan ulang integrations/supabase/app_settings.sql agar anon boleh membaca/menulis app_settings.";
  return `Supabase merespon status ${status}.`;
}

export async function getSettings(): Promise<SettingsResponse> {
  const c = cfg();
  if (!c) return { configured: false, ok: false, message: "Supabase belum dihubungkan (isi url & apikey di src/lib/aqua/config.ts).", settings: null, updatedAt: null };
  try {
    const res = await fetch(`${c.base}?id=eq.default&select=data,updated_at`, { headers: c.headers });
    if (!res.ok) return { configured: true, ok: false, message: httpHint(res.status, await res.text()), settings: null, updatedAt: null };
    const list = (await res.json()) as { data: unknown; updated_at: string }[];
    if (!list.length) return { configured: true, ok: true, message: "Supabase terhubung. Belum ada pengaturan tersimpan, memakai nilai bawaan.", settings: null, updatedAt: null };
    const parsed = settingsSchema.partial().safeParse(list[0]!.data);
    return { configured: true, ok: true, message: "Pengaturan dimuat dari Supabase.", settings: parsed.success ? parsed.data : null, updatedAt: list[0]!.updated_at };
  } catch {
    return { configured: true, ok: false, message: "Gagal menghubungi Supabase. Periksa koneksi internet dan url di config.ts.", settings: null, updatedAt: null };
  }
}

export async function saveSettings(input: Settings): Promise<SettingsResponse> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { configured: true, ok: false, message: "Nilai pengaturan di luar batas yang diizinkan.", settings: null, updatedAt: null };
  const s = parsed.data;
  if (s.phMin >= s.phMax || s.tempMin >= s.tempMax)
    return { configured: true, ok: false, message: "Nilai minimum harus lebih kecil dari maksimum.", settings: null, updatedAt: null };
  const c = cfg();
  if (!c) return { configured: false, ok: false, message: "Supabase belum dihubungkan, pengaturan tidak tersimpan.", settings: null, updatedAt: null };
  try {
    const res = await fetch(`${c.base}?on_conflict=id`, {
      method: "POST",
      headers: { ...c.headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: "default", data: s, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return { configured: true, ok: false, message: httpHint(res.status, await res.text()), settings: null, updatedAt: null };
    const list = (await res.json()) as { data: Settings; updated_at: string }[];
    if (!list.length) return { configured: true, ok: false, message: "Supabase tidak mengonfirmasi penyimpanan.", settings: null, updatedAt: null };
    return { configured: true, ok: true, message: "Pengaturan tersimpan di Supabase.", settings: list[0]!.data, updatedAt: list[0]!.updated_at };
  } catch {
    return { configured: true, ok: false, message: "Gagal menghubungi Supabase.", settings: null, updatedAt: null };
  }
}

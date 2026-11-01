export type Reading = {
  timestamp: string;
  ph: number;
  tds: number;
  temperature: number;
};

export type Status = "NORMAL" | "WASPADA" | "ANOMALI" | "TIDAK CUKUP DATA";

export type Settings = {
  pollInterval: number;
  phMin: number;
  phMax: number;
  tdsMax: number;
  tempMin: number;
  tempMax: number;
  staleThresholdSec: number;
};

export const DEFAULT_SETTINGS: Settings = {
  pollInterval: 5000,
  phMin: 6.5,
  phMax: 8.5,
  tdsMax: 500,
  tempMin: 15,
  tempMax: 35,
  staleThresholdSec: 120,
};

/** Threshold-only check for one reading (used alongside the ML score). */
export function thresholdBreaches(r: Reading, s: Settings): string[] {
  const out: string[] = [];
  if (r.ph < s.phMin) out.push(`pH ${r.ph.toFixed(2)} di bawah batas ${s.phMin}`);
  if (r.ph > s.phMax) out.push(`pH ${r.ph.toFixed(2)} di atas batas ${s.phMax}`);
  if (r.tds > s.tdsMax) out.push(`TDS ${Math.round(r.tds)} ppm melebihi ${s.tdsMax} ppm`);
  if (r.temperature < s.tempMin) out.push(`Suhu ${r.temperature.toFixed(1)}°C di bawah ${s.tempMin}°C`);
  if (r.temperature > s.tempMax) out.push(`Suhu ${r.temperature.toFixed(1)}°C di atas ${s.tempMax}°C`);
  return out;
}

export function paramStatus(kind: "ph" | "tds" | "temperature", v: number | null, s: Settings): Status {
  if (v === null || Number.isNaN(v)) return "TIDAK CUKUP DATA";
  if (kind === "ph") {
    if (v < s.phMin - 1 || v > s.phMax + 1) return "ANOMALI";
    if (v < s.phMin || v > s.phMax) return "WASPADA";
  } else if (kind === "tds") {
    if (v > s.tdsMax * 2) return "ANOMALI";
    if (v > s.tdsMax) return "WASPADA";
  } else {
    if (v < s.tempMin - 5 || v > s.tempMax + 5) return "ANOMALI";
    if (v < s.tempMin || v > s.tempMax) return "WASPADA";
  }
  return "NORMAL";
}

/** A reading plus the 1-based sheet row it came from (needed to delete it in Google Sheets). */
export type SheetReading = Reading & { row: number };

/** Keeps readings whose timestamp falls in [from, to] (inclusive). Empty bound = open. */
export function filterByRange<T extends Reading>(rows: T[], from?: string | null, to?: string | null): T[] {
  const f = from ? new Date(from).getTime() : -Infinity;
  const t = to ? new Date(to).getTime() : Infinity;
  return rows.filter((r) => {
    const v = new Date(r.timestamp).getTime();
    return v >= f && v <= t;
  });
}

export type ParamSummary = { min: number; max: number; avg: number } | null;
/** Min / max / average per parameter. Returns null per parameter when there are no rows. */
export function summarize(rows: Reading[]): { count: number; ph: ParamSummary; tds: ParamSummary; temperature: ParamSummary } {
  const one = (k: "ph" | "tds" | "temperature"): ParamSummary => {
    if (!rows.length) return null;
    let min = Infinity, max = -Infinity, sum = 0;
    for (const r of rows) {
      min = Math.min(min, r[k]);
      max = Math.max(max, r[k]);
      sum += r[k];
    }
    return { min, max, avg: sum / rows.length };
  };
  return { count: rows.length, ph: one("ph"), tds: one("tds"), temperature: one("temperature") };
}

/** Merges new readings into a list without duplicating sheet rows; result sorted oldest first. */
export function mergeRows(prev: SheetReading[], next: SheetReading[]): SheetReading[] {
  const map = new Map<number, SheetReading>();
  for (const r of prev) map.set(r.row, r);
  for (const r of next) map.set(r.row, r);
  return [...map.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.row - b.row);
}

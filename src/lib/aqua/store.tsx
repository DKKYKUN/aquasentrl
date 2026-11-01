import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, mergeRows, thresholdBreaches, type SheetReading, type Settings, type Status } from "./rules";
import { deleteSheetRows, getTelemetry, type DeleteResponse } from "./sheets.functions";
import { getSettings, saveSettings as saveSettingsFn } from "./settings";
export type AiPointOut = { timestamp: string; score: number; status: "NORMAL" | "WASPADA" | "ANOMALI" };
export type AiAnomaly = { timestamp: string; ph: number; tds: number; temperature: number; score: number; params: string[] };

export const MIN_SAMPLES = 10;

export type AiPoint = { score: number; status: Exclude<Status, "TIDAK CUKUP DATA"> };
export type AiResult = {
  points: AiPointOut[];
  contrib: { feature: string; z: number }[];
  mean: number[];
  corr: number[][];
  anomalies: AiAnomaly[];
  anomaly_count: number;
  sample_count: number;
  latest_timestamp: string | null;
  explanation: string;
  n_estimators: number;
  features: number;
  ms: number;
  version: string;
  analyzedAt: string;
};
export type Engine = {
  state: "loading" | "unconfigured" | "waiting" | "analyzing" | "ready" | "error";
  stage: string;
  progress: number;
  version?: string;
  error?: string;
};
export type ServiceState = "connecting" | "unconfigured" | "ok" | "error";
export type Source = "sheets" | "unconfigured";

type Ctx = {
  settings: Settings;
  settingsState: ServiceState;
  settingsMessage: string;
  settingsUpdatedAt: string | null;
  saveSettings: (s: Settings) => Promise<{ ok: boolean; message: string }>;
  rows: SheetReading[];
  latest: SheetReading | null;
  total: number;
  complete: boolean;
  source: Source | null;
  sheetsState: ServiceState;
  sheetsMessage: string;
  sheetsOk: boolean;
  lastSync: Date | null;
  paused: boolean;
  setPaused: (p: boolean) => void;
  refresh: () => void;
  deleteRows: (items: { row: number; timestamp: string }[]) => Promise<DeleteResponse>;
  deleteRange: (from: string, to: string) => Promise<DeleteResponse>;
  engine: Engine;
  ai: AiResult | null;
  aiStale: boolean;
  aiStatus: Status;
  scoredRows: (SheetReading & { score: number | null; status: Status })[];
};

function withDefaults(p: Record<string, number | undefined> | null | undefined): Settings {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(out) as (keyof Settings)[]) if (typeof p?.[k] === "number") out[k] = p[k] as number;
  return out;
}

const AquaCtx = createContext<Ctx | null>(null);

export function AquaProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsState, setSettingsState] = useState<ServiceState>("connecting");
  const [settingsMessage, setSettingsMessage] = useState("Memuat pengaturan…");
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState<string | null>(null);

  const [rows, setRows] = useState<SheetReading[]>([]);
  const [total, setTotal] = useState(0);
  const [complete, setComplete] = useState(false);
  const [sheetsState, setSheetsState] = useState<ServiceState>("connecting");
  const [sheetsMessage, setSheetsMessage] = useState("Menghubungkan ke Google Sheets…");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [paused, setPaused] = useState(false);

  const [engine, setEngine] = useState<Engine>({ state: "loading", stage: "Memuat mesin Python…", progress: 5 });
  const [engineReady, setEngineReady] = useState(false);
  const engineVersion = useRef<string>("");
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const [ai, setAi] = useState<AiResult | null>(null);

  const fetching = useRef(false);
  const knownTotal = useRef(0); // sheet rows already loaded (offset for the next poll)
  const aiBusy = useRef(false);
  const aiKey = useRef("");

  // ---- settings from Supabase ----
  useEffect(() => {
    getSettings()
      .then((r) => {
        if (r.ok) {
          setSettings(withDefaults(r.settings));
          setSettingsUpdatedAt(r.updatedAt);
          setSettingsState("ok");
        } else setSettingsState(r.configured ? "error" : "unconfigured");
        setSettingsMessage(r.message);
      })
      .catch(() => {
        setSettingsState("error");
        setSettingsMessage("Koneksi ke server terputus.");
      });
  }, []);

  const saveSettings = useCallback(async (s: Settings) => {
    try {
      const r = await saveSettingsFn(s);
      if (r.ok && r.settings) {
        setSettings(withDefaults(r.settings));
        setSettingsUpdatedAt(r.updatedAt);
        setSettingsState("ok");
        setSettingsMessage(r.message);
      }
      return { ok: r.ok, message: r.message };
    } catch (e) {
      return { ok: false, message: (e as Error).message || "Gagal menyimpan pengaturan." };
    }
  }, []);

  // ---- sensor data from Google Sheets ----
  const load = useCallback(async (full: boolean) => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const offset = full ? 0 : knownTotal.current;
      let res = await getTelemetry({ data: { offset } });
      // Sheet shrank (rows deleted elsewhere) → reload everything.
      if (res.ok && !full && res.total < offset) res = await getTelemetry({ data: { offset: 0 } });
      const isFull = full || res.offset === 0;
      if (!res.configured) {
        setSheetsState("unconfigured");
        setRows([]);
        setTotal(0);
      } else if (!res.ok) {
        setSheetsState("error");
      } else {
        setSheetsState("ok");
        setTotal(res.total);
        setComplete(res.complete);
        knownTotal.current = res.nextOffset;
        setRows((prev) => (isFull ? res.rows : mergeRows(prev, res.rows)));
        setLastSync(new Date(res.checkedAt));
      }
      setSheetsMessage(res.message);
    } catch {
      setSheetsState("error");
      setSheetsMessage("Koneksi ke server terputus.");
    } finally {
      fetching.current = false;
    }
  }, []);

  const refresh = useCallback(() => void load(true), [load]);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load(knownTotal.current === 0);
    }, settings.pollInterval);
    return () => clearInterval(id);
  }, [load, paused, settings.pollInterval]);

  const afterDelete = useCallback(
    async (r: DeleteResponse) => {
      if (r.ok) {
        knownTotal.current = 0;
        aiKey.current = "";
        // wait for any in-flight poll, then reload from the sheet
        for (let i = 0; i < 50 && fetching.current; i++) await new Promise((ok) => setTimeout(ok, 100));
        await load(true);
      }
      return r;
    },
    [load],
  );

  const deleteRows = useCallback(
    async (items: { row: number; timestamp: string }[]) => {
      try {
        return await afterDelete(await deleteSheetRows({ data: { mode: "rows", items } }));
      } catch (e) {
        return { ok: false, message: (e as Error).message || "Gagal menghapus data.", deleted: 0, skipped: 0 };
      }
    },
    [afterDelete],
  );

  const deleteRange = useCallback(
    async (from: string, to: string) => {
      try {
        return await afterDelete(await deleteSheetRows({ data: { mode: "range", from, to } }));
      } catch (e) {
        return { ok: false, message: (e as Error).message || "Gagal menghapus data.", deleted: 0, skipped: 0 };
      }
    },
    [afterDelete],
  );

  // ---- Python ML (Pyodide + scikit-learn) running inside the browser ----
  useEffect(() => {
    const w = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "stage") setEngine({ state: "loading", stage: m.stage, progress: m.progress });
      else if (m.type === "ready") {
        engineVersion.current = m.version;
        setEngineReady(true);
        setEngine({ state: "waiting", stage: "Menunggu data sensor…", progress: 100, version: m.version });
      } else if (m.type === "result") {
        aiBusy.current = false;
        if (m.id !== reqId.current) return;
        setAi({ ...m.result, version: engineVersion.current, analyzedAt: new Date().toISOString() });
        setEngine({ state: "ready", stage: "Siap", progress: 100, version: engineVersion.current });
      } else if (m.type === "error") {
        aiBusy.current = false;
        aiKey.current = "";
        setEngine((en) => ({ ...en, state: "error", stage: "Gagal", progress: 0, error: m.message }));
      }
    };
    w.postMessage({ type: "init" });
    return () => w.terminate();
  }, []);

  // ---- automatic analysis whenever data or thresholds change (no button) ----
  const latest = rows.at(-1) ?? null;
  useEffect(() => {
    if (!engineReady || sheetsState !== "ok") return;
    if (rows.length < MIN_SAMPLES) {
      setAi(null);
      setEngine({ state: "waiting", stage: `AI menunggu data yang memadai: ${rows.length} dari minimal ${MIN_SAMPLES} sampel.`, progress: 100, version: engineVersion.current });
      return;
    }
    const key = `${rows.length}|${latest?.timestamp}|${latest?.row}|${JSON.stringify(settings)}`;
    if (key === aiKey.current || aiBusy.current) return;
    aiBusy.current = true;
    aiKey.current = key;
    setEngine((e) => ({ ...e, state: "analyzing", stage: "Menganalisis data terbaru…", progress: 60 }));
    const id = ++reqId.current;
    workerRef.current?.postMessage({ type: "analyze", id, rows: rows.map(({ timestamp, ph, tds, temperature }) => ({ timestamp, ph, tds, temperature })), thresholds: settings });
  }, [rows, latest, settings, sheetsState, lastSync, engineReady]);

  const aiStale = !!ai && !!latest && ai.latest_timestamp !== latest.timestamp;

  const scoredRows = useMemo(() => {
    const map = new Map<string, AiPoint>();
    if (ai) for (const p of ai.points) map.set(p.timestamp, p);
    return rows.map((r) => {
      const p = map.get(r.timestamp);
      const fallback: Status = thresholdBreaches(r, settings).length ? "WASPADA" : "NORMAL";
      return { ...r, score: p?.score ?? null, status: (p?.status ?? (rows.length < MIN_SAMPLES ? "TIDAK CUKUP DATA" : fallback)) as Status };
    });
  }, [rows, ai, settings]);

  const aiStatus: Status = scoredRows.length ? scoredRows[scoredRows.length - 1]!.status : "TIDAK CUKUP DATA";

  const value: Ctx = {
    settings, settingsState, settingsMessage, settingsUpdatedAt, saveSettings,
    rows, latest, total, complete,
    source: sheetsState === "unconfigured" ? "unconfigured" : sheetsState === "connecting" ? null : "sheets",
    sheetsState, sheetsMessage, sheetsOk: sheetsState === "ok", lastSync, paused, setPaused, refresh,
    deleteRows, deleteRange, engine, ai, aiStale, aiStatus, scoredRows,
  };
  return <AquaCtx.Provider value={value}>{children}</AquaCtx.Provider>;
}

export function useAqua() {
  const c = useContext(AquaCtx);
  if (!c) throw new Error("useAqua must be used inside AquaProvider");
  return c;
}

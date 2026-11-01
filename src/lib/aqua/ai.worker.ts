/// <reference lib="webworker" />
// Runs a real Python + scikit-learn Isolation Forest inside the browser via Pyodide.
const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

const PY_CODE = `
import json
import numpy as np
from sklearn.ensemble import IsolationForest

def analyze(rows_json, th_json):
    rows = json.loads(rows_json)
    th = json.loads(th_json)
    rows = rows[-5000:]
    X = np.array([[r["ph"], r["tds"], r["temperature"]] for r in rows], dtype=float)
    n = len(X)
    d = np.vstack([np.zeros((1, 3)), np.diff(X, axis=0)])
    win = 5
    roll = np.array([X[max(0, i - win + 1): i + 1].std(axis=0) for i in range(n)])
    F = np.hstack([X, d, roll])
    mu = F.mean(axis=0)
    sd = F.std(axis=0)
    sd[sd == 0] = 1.0
    Z = (F - mu) / sd
    model = IsolationForest(n_estimators=150, contamination="auto", random_state=42)
    model.fit(Z)
    scores = model.decision_function(Z)

    names = ["pH", "TDS", "Suhu", "Perubahan pH", "Perubahan TDS", "Perubahan Suhu", "Fluktuasi pH", "Fluktuasi TDS", "Fluktuasi Suhu"]
    out = []
    anomalies = []
    base = ["pH", "TDS", "Suhu"]
    for i in range(n):
        ph, tds, t = X[i]
        breach = (ph < th["phMin"] or ph > th["phMax"] or tds > th["tdsMax"] or t < th["tempMin"] or t > th["tempMax"])
        s = float(scores[i])
        if s < -0.06:
            st = "ANOMALI"
        elif s < 0.0 or breach:
            st = "WASPADA"
        else:
            st = "NORMAL"
        out.append({"timestamp": rows[i]["timestamp"], "score": round(s, 4), "status": st})
        if st == "ANOMALI":
            dev = np.abs(Z[i][:3])
            params = [base[j] for j in np.argsort(-dev) if dev[j] >= 1.5][:3] or [base[int(np.argmax(dev))]]
            anomalies.append({"timestamp": rows[i]["timestamp"], "ph": float(ph), "tds": float(tds), "temperature": float(t), "score": round(s, 4), "params": params})

    last = np.abs(Z[-1])
    order = np.argsort(-last)[:3]
    contrib = [{"feature": names[j], "z": round(float(last[j]), 2)} for j in order]
    mean = X.mean(axis=0).tolist()
    corr = np.corrcoef(X.T) if n > 2 else np.eye(3)
    corr = np.nan_to_num(corr).round(3).tolist()
    p = out[-1]["status"]
    if p == "ANOMALI":
        expl = f"Sampel terbaru menyimpang dari pola {n} sampel, terutama {contrib[0]['feature']} ({contrib[0]['z']}σ)."
    elif p == "WASPADA":
        expl = "Sampel terbaru mendekati tepi pola normal atau melewati ambang batas pengaturan."
    else:
        expl = f"Sampel terbaru sesuai pola {n} sampel historis."
    expl += f" {len(anomalies)} sampel terindikasi anomali oleh model."
    return json.dumps({
        "anomalies": anomalies,
        "sample_count": n,
        "latest_timestamp": rows[-1]["timestamp"],
        "explanation": expl,
        "points": out,
        "contrib": contrib,
        "mean": mean,
        "corr": corr,
        "anomaly_count": len(anomalies),
        "n_estimators": 150,
        "features": len(names),
    })
`;

type PyAPI = {
  loadPackage: (p: string[]) => Promise<void>;
  runPython: (c: string) => unknown;
  globals: { get: (n: string) => (a: string, b: string) => string };
};

let py: PyAPI | null = null;
let ready: Promise<void> | null = null;

function post(msg: unknown) {
  (self as unknown as Worker).postMessage(msg);
}

async function init() {
  post({ type: "stage", stage: "Memuat runtime Python (Pyodide)…", progress: 15 });
  const mod = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
  py = (await mod.loadPyodide({ indexURL: PYODIDE_URL })) as PyAPI;
  post({ type: "stage", stage: "Memuat NumPy & scikit-learn…", progress: 55 });
  await py.loadPackage(["numpy", "scikit-learn"]);
  post({ type: "stage", stage: "Menyiapkan model Isolation Forest…", progress: 90 });
  py.runPython(PY_CODE);
  const ver = py.runPython("import sys, sklearn; f'Python {sys.version.split()[0]} · scikit-learn {sklearn.__version__}'");
  post({ type: "ready", version: String(ver) });
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as { type: string; id?: number; rows?: unknown; thresholds?: unknown };
  try {
    if (msg.type === "init") {
      ready ??= init();
      await ready;
      return;
    }
    if (msg.type === "analyze") {
      ready ??= init();
      await ready;
      const t0 = performance.now();
      const fn = py!.globals.get("analyze");
      const res = JSON.parse(fn(JSON.stringify(msg.rows), JSON.stringify(msg.thresholds)));
      post({ type: "result", id: msg.id, result: { ...res, ms: Math.round(performance.now() - t0) } });
    }
  } catch (err) {
    post({ type: "error", id: msg.id, message: (err as Error).message });
  }
};

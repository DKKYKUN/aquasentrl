import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, RefreshCw, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardTitle, PageHeader } from "@/components/aqua/ui";
import { useAqua } from "@/lib/aqua/store";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/aqua/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan — Aqua Sentinel" },
      { name: "description", content: "Atur ambang batas pH, TDS, suhu dan interval pembaruan data, tersimpan di Supabase." },
      { property: "og:title", content: "Pengaturan — Aqua Sentinel" },
      { property: "og:description", content: "Atur ambang batas pH, TDS, suhu dan interval pembaruan." },
    ],
  }),
  component: SettingsPage,
});

const FIELDS: { key: keyof Settings; label: string; step: number; scale?: number }[] = [
  { key: "phMin", label: "pH minimum", step: 0.1 },
  { key: "phMax", label: "pH maksimum", step: 0.1 },
  { key: "tdsMax", label: "TDS maksimum (ppm)", step: 10 },
  { key: "tempMin", label: "Suhu minimum (°C)", step: 0.5 },
  { key: "tempMax", label: "Suhu maksimum (°C)", step: 0.5 },
  { key: "pollInterval", label: "Interval pembaruan (detik)", step: 1, scale: 1000 },
  { key: "staleThresholdSec", label: "Data dianggap lama setelah (detik)", step: 10 },
];

function SettingsPage() {
  const { settings, saveSettings, settingsState, settingsMessage, settingsUpdatedAt, sheetsState, sheetsMessage, lastSync, total, refresh } = useAqua();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(settings), [settings]);

  const save = async () => {
    if (form.phMin >= form.phMax || form.tempMin >= form.tempMax || form.pollInterval < 2000) {
      toast.error("Periksa kembali: nilai minimum harus lebih kecil dari maksimum, interval minimal 2 detik.");
      return;
    }
    setSaving(true);
    const r = await saveSettings(form);
    setSaving(false);
    if (r.ok) toast.success(r.message);
    else toast.error(r.message);
  };

  const reset = () => {
    setForm(DEFAULT_SETTINGS);
    toast.info("Nilai bawaan dimuat. Klik “Simpan ke Supabase” untuk menyimpannya.");
  };

  const dot = (s: string) => (s === "ok" ? "bg-normal" : s === "connecting" ? "bg-warn" : "bg-danger");

  return (
    <div>
      <PageHeader title="Pengaturan" sub="Ambang batas dipakai untuk status Waspada, peringatan, dan analisis AI" />
      <Card className="mb-4 max-w-2xl space-y-3">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className={cn("h-2 w-2 rounded-full", dot(settingsState))} />
            <span className="font-semibold">Supabase</span>
            <span className="text-muted-foreground">{settingsMessage}</span>
          </div>
          {settingsUpdatedAt && <p className="mt-1 text-[11px] text-muted-foreground">Terakhir disimpan: {new Date(settingsUpdatedAt).toLocaleString("id-ID")}</p>}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("h-2 w-2 rounded-full", dot(sheetsState))} />
            <span className="font-semibold">Google Sheets</span>
            <span className="text-muted-foreground">{sheetsMessage}</span>
            <Button size="sm" variant="outline" className="ml-auto h-7 px-2 text-xs" onClick={refresh}>
              <RefreshCw />Cek koneksi
            </Button>
          </div>
          {sheetsState === "ok" && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {total} baris data{lastSync ? ` · sinkron terakhir ${lastSync.toLocaleTimeString("id-ID")}` : ""}
            </p>
          )}
          {sheetsState === "unconfigured" && (
            <p className="mt-1 text-[11px] text-muted-foreground">Tempel URL Web App Apps Script (…/exec) pada <code>sheets.url</code> di <code>src/lib/aqua/config.ts</code>.</p>
          )}
        </div>
      </Card>
      <Card className="max-w-2xl">
        <CardTitle title="Ambang Batas & Pembaruan" />
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step={f.step}
                value={f.scale ? form[f.key] / f.scale : form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) * (f.scale ?? 1) })}
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={save} disabled={settingsState === "unconfigured" || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}Simpan ke Supabase
          </Button>
          <Button variant="outline" onClick={reset} disabled={saving}><RotateCcw />Kembalikan bawaan</Button>
        </div>
        {settingsState === "unconfigured" && <p className="mt-3 text-xs text-muted-foreground">Isi <code>url</code> dan <code>apikey</code> Supabase di <code>src/lib/aqua/config.ts</code> agar pengaturan bisa disimpan permanen.</p>}
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Droplets, FlaskConical, Globe, Sheet, Thermometer, BrainCircuit, Cpu } from "lucide-react";
import { Card, PageHeader, fmtDateTime } from "@/components/aqua/ui";
import { useAqua } from "@/lib/aqua/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/perangkat")({
  head: () => ({
    meta: [
      { title: "Perangkat IoT — Aqua Sentinel" },
      { name: "description", content: "Status ESP32, sensor pH, TDS, DS18B20, Google Sheets, Supabase dan layanan AI." },
      { property: "og:title", content: "Perangkat IoT — Aqua Sentinel" },
      { property: "og:description", content: "Status perangkat ESP32 dan layanan yang terhubung." },
    ],
  }),
  component: Devices,
});

type Tone = "normal" | "warn" | "danger";

function Devices() {
  const { latest, settings, sheetsState, sheetsMessage, settingsState, settingsMessage, engine, lastSync } = useAqua();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const age = latest && now ? (now - new Date(latest.timestamp).getTime()) / 1000 : null;
  const fresh = age !== null && age <= settings.staleThresholdSec;

  // ESP32 status is derived only from the age of the last row in Google Sheets.
  const esp: { state: string; tone: Tone } =
    sheetsState !== "ok" ? { state: "Tidak diketahui", tone: "warn" } : !latest ? { state: "Belum ada data", tone: "warn" } : fresh ? { state: "Mengirim data", tone: "normal" } : { state: "Tidak mengirim", tone: "danger" };

  const sensors = [
    { name: "Sensor pH", icon: FlaskConical, value: latest ? latest.ph.toFixed(2) : "—", desc: "Tingkat keasaman air" },
    { name: "Sensor TDS", icon: Droplets, value: latest ? `${Math.round(latest.tds)} ppm` : "—", desc: "Jumlah zat terlarut" },
    { name: "Sensor Suhu DS18B20", icon: Thermometer, value: latest ? `${latest.temperature.toFixed(1)} °C` : "—", desc: "Suhu air" },
  ];
  const svc = (s: string): Tone => (s === "ok" ? "normal" : s === "connecting" ? "warn" : "danger");
  const label = (s: string) => (s === "ok" ? "Terhubung" : s === "connecting" ? "Menghubungkan" : s === "unconfigured" ? "Belum dihubungkan" : "Error");
  const services = [
    { name: "Google Sheets (data sensor)", icon: Sheet, state: label(sheetsState), tone: svc(sheetsState), desc: sheetsMessage },
    { name: "Supabase (pengaturan)", icon: Database, state: label(settingsState), tone: svc(settingsState), desc: settingsMessage },
    {
      name: "AI Python (di web)",
      icon: BrainCircuit,
      state: engine.state === "ready" ? "Aktif" : engine.state === "analyzing" ? "Menganalisis" : engine.state === "waiting" ? "Menunggu data" : engine.state === "loading" ? "Memuat" : engine.state === "unconfigured" ? "Belum dihubungkan" : "Error",
      tone: (engine.state === "ready" ? "normal" : engine.state === "analyzing" || engine.state === "waiting" || engine.state === "loading" ? "warn" : "danger") as Tone,
      desc: engine.error ?? engine.version ?? engine.stage,
    },
    { name: "Koneksi web", icon: Globe, state: lastSync ? "Sinkron" : "Belum sinkron", tone: (lastSync ? "normal" : "warn") as Tone, desc: lastSync ? `Sinkron terakhir ${lastSync.toLocaleTimeString("id-ID")}` : "Belum ada respons valid dari Google Sheets" },
  ];

  return (
    <div>
      <PageHeader title="Perangkat IoT" sub="ESP32 mengirim data ke Google Sheets; web hanya membaca dari sana" />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-accent p-2.5 text-accent-foreground"><Cpu className="h-5 w-5" /></div>
          <div className="flex-1">
            <p className="text-sm font-bold">ESP32 Aqua Sentinel</p>
            <p className="text-xs text-muted-foreground">
              Data terakhir diterima: {latest ? `${fmtDateTime(latest.timestamp)}${age !== null ? ` (${formatAge(age)} lalu)` : ""}` : "belum ada"}
            </p>
          </div>
          <Badge tone={esp.tone} text={esp.state} />
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {sensors.map((s, i) => (
          <Card key={s.name} className="lift" delay={i * 70}>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-accent p-2.5 text-accent-foreground"><s.icon className="h-5 w-5" /></div>
              <Badge tone={esp.tone} text={latest ? (fresh ? "Data baru" : "Data lama") : "Belum ada data"} />
            </div>
            <p className="mt-4 text-sm font-bold">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
            <p className="mt-3 font-display text-2xl font-extrabold">{s.value}</p>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {services.map((s, i) => (
          <Card key={s.name} delay={220 + i * 70}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent p-2.5 text-accent-foreground"><s.icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <Badge tone={s.tone} text={s.state} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatAge(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} detik`;
  if (s < 3600) return `${Math.round(s / 60)} menit`;
  if (s < 86400) return `${Math.round(s / 3600)} jam`;
  return `${Math.round(s / 86400)} hari`;
}

function Badge({ tone, text }: { tone: Tone; text: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tone === "normal" ? "bg-normal-soft text-normal" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger")}>
      <span className={cn("h-1.5 w-1.5 rounded-full pulse-dot", tone === "normal" ? "bg-normal" : tone === "warn" ? "bg-warn" : "bg-danger")} />
      {text}
    </span>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, ChartEmpty, PageHeader, StatusPill, fmtTime, tooltipStyle, usePalette } from "@/components/aqua/ui";
import { useAqua } from "@/lib/aqua/store";
import { paramStatus } from "@/lib/aqua/rules";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Monitoring Real-Time — Aqua Sentinel" },
      { name: "description", content: "Grafik langsung pH, TDS, dan suhu air beserta batas idealnya." },
      { property: "og:title", content: "Monitoring Real-Time — Aqua Sentinel" },
      { property: "og:description", content: "Grafik langsung pH, TDS, dan suhu air beserta batas idealnya." },
    ],
  }),
  component: Monitoring,
});

function Monitoring() {
  const { rows, settings, paused, setPaused, refresh, latest } = useAqua();
  const c = usePalette();
  const data = rows.slice(-60).map((r) => ({ t: fmtTime(r.timestamp), ph: r.ph, tds: r.tds, temperature: r.temperature }));
  const charts = [
    { key: "ph" as const, title: "pH Air", color: c.ph, unit: "", lines: [settings.phMin, settings.phMax] },
    { key: "tds" as const, title: "TDS (Total Dissolved Solids)", color: c.tds, unit: "ppm", lines: [settings.tdsMax] },
    { key: "temperature" as const, title: "Suhu Air (DS18B20)", color: c.temp, unit: "°C", lines: [settings.tempMin, settings.tempMax] },
  ];
  return (
    <div>
      <PageHeader
        title="Monitoring Real-Time"
        sub={`Diperbarui setiap ${settings.pollInterval / 1000} detik · 60 pengukuran terakhir`}
        right={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPaused(!paused)}>{paused ? <Play /> : <Pause />}{paused ? "Lanjutkan" : "Jeda"}</Button>
            <Button onClick={refresh}><RefreshCw />Muat ulang</Button>
          </div>
        }
      />
      <div className="grid gap-4">
        {charts.map((ch, i) => (
          <Card key={ch.key} delay={i * 90}>
            <CardTitle
              title={ch.title}
              sub={latest ? `Terkini: ${latest[ch.key]} ${ch.unit}` : "Menunggu data"}
              right={<StatusPill status={paramStatus(ch.key, latest ? latest[ch.key] : null, settings)} />}
            />
                          <div className="relative h-56">
              <ResponsiveContainer>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id={`m-${ch.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ch.color} stopOpacity={0.3} /><stop offset="100%" stopColor={ch.color} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke={c.grid} vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip {...tooltipStyle} />
                    {ch.lines.map((l) => <ReferenceLine key={l} y={l} stroke={c.warn} strokeDasharray="4 4" />)}
                    <Area type="monotone" dataKey={ch.key} stroke={ch.color} strokeWidth={2.5} fill={`url(#m-${ch.key})`} dot={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              <ChartEmpty show={!data.length} />
              </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

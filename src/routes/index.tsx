import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrainCircuit, Droplets, FlaskConical, Thermometer, ArrowRight } from "lucide-react";
import { Card, CardTitle, ChartEmpty, PageHeader, Sparkline, StatusPill, fmtTime, tooltipStyle, usePalette, statusStyle } from "@/components/aqua/ui";
import { useAqua } from "@/lib/aqua/store";
import { paramStatus } from "@/lib/aqua/rules";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Aqua Sentinel" },
      { name: "description", content: "Ringkasan kondisi air real-time: pH, TDS, suhu, dan status AI." },
      { property: "og:title", content: "Dashboard — Aqua Sentinel" },
      { property: "og:description", content: "Ringkasan kondisi air real-time: pH, TDS, suhu, dan status AI." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { latest, rows, settings, aiStatus, ai, scoredRows } = useAqua();
  const c = usePalette();
  const last30 = rows.slice(-30);
  const sensors = [
    { key: "ph" as const, label: "pH Air", unit: "", icon: FlaskConical, color: c.ph, fmt: (v: number) => v.toFixed(2), range: `Ideal ${settings.phMin}–${settings.phMax}` },
    { key: "tds" as const, label: "TDS", unit: "ppm", icon: Droplets, color: c.tds, fmt: (v: number) => Math.round(v).toString(), range: `Maks ${settings.tdsMax} ppm` },
    { key: "temperature" as const, label: "Suhu Air", unit: "°C", icon: Thermometer, color: c.temp, fmt: (v: number) => v.toFixed(1), range: `Ideal ${settings.tempMin}–${settings.tempMax}°C` },
  ];

  const counts = { NORMAL: 0, WASPADA: 0, ANOMALI: 0 };
  scoredRows.forEach((r) => {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
  });
  const total = counts.NORMAL + counts.WASPADA + counts.ANOMALI;
  const pie = [
    { name: "Normal", value: counts.NORMAL, color: c.normal },
    { name: "Waspada", value: counts.WASPADA, color: c.warn },
    { name: "Anomali", value: counts.ANOMALI, color: c.danger },
  ];
  const chart = last30.map((r) => ({ t: fmtTime(r.timestamp), ph: r.ph, tds: r.tds, temp: r.temperature }));
  const scores = scoredRows.slice(-20).map((r) => ({ t: fmtTime(r.timestamp), score: r.score ?? 0, status: r.status }));

  return (
    <div>
      <PageHeader title="Dashboard Kondisi Air" sub="Ringkasan langsung dari sensor pH, TDS, dan DS18B20" right={<StatusPill status={aiStatus} className="text-sm" />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sensors.map((s, i) => {
          const v = latest ? latest[s.key] : null;
          const st = paramStatus(s.key, v, settings);
          return (
            <Card key={s.key} className="lift" delay={i * 70}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-1 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs font-semibold text-muted-foreground">{s.label}</span>
                </div>
                <StatusPill status={st} />
              </div>
              <p className="mt-3 font-display text-3xl font-extrabold tabular-nums transition-all">
                {v === null ? "—" : s.fmt(v)}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">{s.unit}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">{s.range}</p>
              <Sparkline id={`sp-${s.key}`} color={s.color} data={last30.map((r) => r[s.key])} />
            </Card>
          );
        })}
        <Card className="lift bg-brand text-primary-foreground" delay={210}>
          <div className="flex items-center gap-2 text-xs font-semibold opacity-90"><BrainCircuit className="h-4 w-4" /> Analisis AI (Python)</div>
          <p className="mt-3 font-display text-3xl font-extrabold">{statusStyle[aiStatus].label}</p>
          <p className="text-[11px] opacity-90">
            Skor anomali: {scoredRows.at(-1)?.score?.toFixed(3) ?? "—"} · {ai ? `${ai.ms} ms` : "menunggu model"}
          </p>
          <Link to="/ai" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline">
            Lihat detail <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" delay={260}>
          <CardTitle title="Grafik Perubahan Parameter" sub="30 pengukuran terakhir" />
                      <div className="relative h-72">
              <ResponsiveContainer>
                <ComposedChart data={chart}>
                  <defs>
                    <linearGradient id="gph" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.ph} stopOpacity={0.3} /><stop offset="100%" stopColor={c.ph} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} width={32} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip {...tooltipStyle} />
                  <Area yAxisId="l" type="monotone" dataKey="ph" name="pH" stroke={c.ph} strokeWidth={2.5} fill="url(#gph)" />
                  <Line yAxisId="l" type="monotone" dataKey="temp" name="Suhu °C" stroke={c.temp} strokeWidth={2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="tds" name="TDS ppm" stroke={c.tds} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            <ChartEmpty show={!chart.length} />
              </div>
        </Card>

        <Card delay={320}>
          <CardTitle title="Distribusi Status" sub="Hasil klasifikasi AI" />
          <div className="relative mx-auto h-44 w-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={total ? pie : [{ name: "-", value: 1, color: c.grid }]} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={total ? 3 : 0} stroke="none">
                  {(total ? pie : [{ color: c.grid }]).map((p, i) => <Cell key={i} fill={p.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-extrabold">{total}</span>
              <span className="text-[10px] text-muted-foreground">sampel</span>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {pie.map((p) => {
              const pct = total ? Math.round((p.value / total) * 100) : 0;
              return (
                <div key={p.name} className="text-xs">
                  <div className="flex justify-between"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name}</span><span className="font-semibold">{pct}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: p.color }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-4" delay={380}>
        <CardTitle title="Skor Anomali per Pengukuran" sub="Nilai negatif = makin menyimpang dari pola normal (Isolation Forest)" />
        <div className="h-48">
          <ResponsiveContainer>
            <BarChart data={scores}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} width={40} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="score" name="Skor" radius={[6, 6, 6, 6]}>
                {scores.map((s, i) => <Cell key={i} fill={s.status === "ANOMALI" ? c.danger : s.status === "WASPADA" ? c.warn : c.normal} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

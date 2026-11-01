import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownUp, ChevronLeft, ChevronRight, Download, Printer, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardTitle, ChartEmpty, PageHeader, StatusPill, fmtDateTime, tooltipStyle, usePalette } from "@/components/aqua/ui";
import { ConfirmDialog } from "@/components/aqua/ConfirmDialog";
import { useAqua } from "@/lib/aqua/store";
import { filterByRange, summarize, type Status } from "@/lib/aqua/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat & Laporan — Aqua Sentinel" },
      { name: "description", content: "Telusuri seluruh riwayat pengukuran pH, TDS, suhu dari Google Sheets, buat laporan, dan hapus data." },
      { property: "og:title", content: "Riwayat & Laporan — Aqua Sentinel" },
      { property: "og:description", content: "Telusuri seluruh riwayat pengukuran dan unduh laporannya." },
    ],
  }),
  component: History,
});

const FILTERS: (Status | "SEMUA")[] = ["SEMUA", "NORMAL", "WASPADA", "ANOMALI"];
const PAGE_SIZE = 50;
const MAX_CHART_POINTS = 400;

type Pending = { kind: "rows"; items: { row: number; timestamp: string }[] } | { kind: "range"; from: string; to: string; count: number } | null;

function History() {
  const { scoredRows, sheetsState, sheetsMessage, total, complete, rows, refresh, deleteRows, deleteRange, lastSync } = useAqua();
  const c = usePalette();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("SEMUA");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<Pending>(null);

  const ranged = useMemo(() => filterByRange(scoredRows, from || null, to || null), [scoredRows, from, to]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = ranged.filter(
      (r) =>
        (filter === "SEMUA" || r.status === filter) &&
        (!q || fmtDateTime(r.timestamp).toLowerCase().includes(q) || `${r.ph} ${r.tds} ${r.temperature}`.includes(q)),
    );
    return desc ? out.reverse() : out;
  }, [ranged, filter, query, desc]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  useEffect(() => setPage(0), [filter, from, to, query, desc]);
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  // Drop selections for rows that no longer exist (e.g. after a delete).
  useEffect(() => {
    setSelected((s) => {
      const live = new Set(rows.map((r) => r.row));
      const next = new Set([...s].filter((r) => live.has(r)));
      return next.size === s.size ? s : next;
    });
  }, [rows]);
  const pageRows = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const report = useMemo(() => summarize(ranged), [ranged]);
  const anomalies = ranged.filter((r) => r.status === "ANOMALI").length;
  const chart = useMemo(() => {
    const step = Math.max(1, Math.ceil(ranged.length / MAX_CHART_POINTS));
    return ranged.filter((_, i) => i % step === 0 || i === ranged.length - 1).map((r) => ({ t: fmtDateTime(r.timestamp), ph: r.ph, tds: r.tds, temp: r.temperature }));
  }, [ranged]);

  const toggle = (row: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(row)) n.delete(row);
      else n.add(row);
      return n;
    });
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.row));
  const togglePage = () =>
    setSelected((s) => {
      const n = new Set(s);
      pageRows.forEach((r) => (allOnPage ? n.delete(r.row) : n.add(r.row)));
      return n;
    });

  const exportCsv = () => {
    const head = "waktu,ph,tds_ppm,suhu_c,skor_ai,status\n";
    const body = ranged.map((r) => `${r.timestamp},${r.ph},${r.tds},${r.temperature},${r.score ?? ""},${r.status}`).join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `aqua-sentinel-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabel = from || to ? `${from ? new Date(from).toLocaleString("id-ID") : "awal data"} — ${to ? new Date(to).toLocaleString("id-ID") : "data terbaru"}` : "Seluruh data";
  const canDelete = sheetsState === "ok";

  const fmt = (v: number | undefined, d: number) => (v === undefined ? "—" : v.toFixed(d));

  return (
    <div>
      <PageHeader
        title="Riwayat & Laporan"
        sub="Sumber data: Google Sheets"
        right={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh}><RefreshCw />Muat ulang</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer />Cetak / PDF</Button>
            <Button onClick={exportCsv} disabled={!ranged.length}><Download />Unduh CSV</Button>
          </div>
        }
      />

      <Card className="no-print mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("h-2 w-2 rounded-full", sheetsState === "ok" ? "bg-normal" : sheetsState === "connecting" ? "bg-warn" : "bg-danger")} />
          <span className="font-semibold">{sheetsMessage}</span>
          <span className="text-muted-foreground">
            {sheetsState === "ok" && `${rows.length.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")} baris dimuat${complete ? "" : " — sisa data sedang dimuat bertahap"}`}
            {lastSync && ` · sinkron ${lastSync.toLocaleTimeString("id-ID")}`}
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">Dari</Label>
            <Input id="from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">Sampai</Label>
            <Input id="to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="q" className="text-xs">Cari</Label>
            <Input id="q" placeholder="Tanggal atau nilai…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); setQuery(""); setFilter("SEMUA"); }}>Reset</Button>
          </div>
        </div>
      </Card>

      {/* Laporan */}
      <Card className="mb-4" delay={60}>
        <CardTitle
          title="Laporan"
          sub={`${rangeLabel} · ${report.count.toLocaleString("id-ID")} sampel · ${anomalies} anomali`}
          right={
            <Button
              size="sm"
              variant="outline"
              className="no-print"
              disabled={!canDelete || !report.count}
              onClick={() =>
                from && to
                  ? setPending({ kind: "range", from, to, count: report.count })
                  : setPending({ kind: "rows", items: ranged.map((r) => ({ row: r.row, timestamp: r.timestamp })) })
              }
            >
              <Trash2 />Hapus data laporan
            </Button>
          }
        />
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {([
            ["pH", report.ph, 2, ""],
            ["TDS", report.tds, 0, " ppm"],
            ["Suhu", report.temperature, 1, " °C"],
          ] as const).map(([k, s, d, u]) => (
            <div key={k} className="rounded-xl bg-muted/60 p-3">
              <p className="text-xs font-semibold text-muted-foreground">{k}</p>
              <div className="mt-1 grid grid-cols-3 text-center text-xs">
                <div><p className="text-muted-foreground">Min</p><p className="font-display text-base font-bold">{fmt(s?.min, d)}{s ? u : ""}</p></div>
                <div><p className="text-muted-foreground">Rata-rata</p><p className="font-display text-base font-bold">{fmt(s?.avg, d)}{s ? u : ""}</p></div>
                <div><p className="text-muted-foreground">Maks</p><p className="font-display text-base font-bold">{fmt(s?.max, d)}{s ? u : ""}</p></div>
              </div>
            </div>
          ))}
        </div>
        <div className="relative h-64">
          <ResponsiveContainer>
            <LineChart data={chart}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} minTickGap={60} />
              <YAxis yAxisId="l" tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} width={32} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: c.muted }} tickLine={false} axisLine={false} width={40} />
              <Tooltip {...tooltipStyle} />
              <Line yAxisId="l" type="monotone" dataKey="ph" name="pH" stroke={c.ph} strokeWidth={2} dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="temp" name="Suhu °C" stroke={c.temp} strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="tds" name="TDS ppm" stroke={c.tds} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <ChartEmpty show={!chart.length} text={sheetsState === "ok" ? "Belum ada data pada rentang ini" : "Menunggu data sensor"} />
        </div>
        {ranged.length > MAX_CHART_POINTS && <p className="mt-2 text-[11px] text-muted-foreground">Grafik menampilkan {chart.length} titik yang mewakili {ranged.length.toLocaleString("id-ID")} sampel.</p>}
      </Card>

      {/* Riwayat */}
      <Card delay={120} className="p-0">
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-border p-4">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-all", filter === f ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}>
              {f === "SEMUA" ? "Semua" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setDesc(!desc)}><ArrowDownUp />{desc ? "Terbaru dulu" : "Terlama dulu"}</Button>
          <span className="ml-auto text-xs text-muted-foreground">{list.length.toLocaleString("id-ID")} baris</span>
          <Button
            size="sm"
            variant="destructive"
            disabled={!canDelete || !selected.size}
            onClick={() => setPending({ kind: "rows", items: rows.filter((r) => selected.has(r.row)).map((r) => ({ row: r.row, timestamp: r.timestamp })) })}
          >
            <Trash2 />Hapus terpilih ({selected.size})
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="no-print w-10 px-4 py-3"><Checkbox checked={allOnPage} onCheckedChange={togglePage} aria-label="Pilih semua di halaman ini" /></th>
                {["Waktu", "pH", "TDS (ppm)", "Suhu (°C)", "Skor AI", "Status", ""].map((h, i) => <th key={i} className="px-4 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.row} className={cn("border-t border-border/60 transition-colors hover:bg-accent/40", selected.has(r.row) && "bg-accent/50")}>
                  <td className="no-print px-4 py-2.5"><Checkbox checked={selected.has(r.row)} onCheckedChange={() => toggle(r.row)} aria-label={`Pilih ${fmtDateTime(r.timestamp)}`} /></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDateTime(r.timestamp)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.ph.toFixed(2)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{Math.round(r.tds)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.temperature.toFixed(1)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.score?.toFixed(3) ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="no-print px-2 py-2.5">
                    <button
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                      disabled={!canDelete}
                      aria-label="Hapus baris ini"
                      onClick={() => setPending({ kind: "rows", items: [{ row: r.row, timestamp: r.timestamp }] })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    {sheetsState === "connecting" ? "Memuat data dari Google Sheets…" : sheetsState === "ok" ? "Belum ada data." : sheetsMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="no-print flex items-center justify-end gap-2 border-t border-border p-3 text-xs">
          <span className="text-muted-foreground">Halaman {page + 1} dari {pages}</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Halaman sebelumnya"><ChevronLeft /></Button>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Halaman berikutnya"><ChevronRight /></Button>
        </div>
      </Card>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        destructive
        title="Hapus data dari Google Sheets?"
        confirmLabel="Hapus permanen"
        description={
          pending?.kind === "range" ? (
            <>
              <p>Semua baris sumber di Google Sheets dengan waktu antara <b>{new Date(pending.from).toLocaleString("id-ID")}</b> dan <b>{new Date(pending.to).toLocaleString("id-ID")}</b> akan dihapus (saat ini {pending.count} baris terlihat).</p>
              <p>Data di luar rentang ini tidak tersentuh. Grafik, statistik, dan laporan akan dihitung ulang dari data yang tersisa.</p>
            </>
          ) : (
            <>
              <p>{pending?.items.length ?? 0} baris sumber akan dihapus permanen dari Google Sheets. Header dan baris lain tidak diubah.</p>
              <p>Grafik, statistik, dan laporan akan dihitung ulang dari data yang tersisa.</p>
            </>
          )
        }
        onConfirm={async () => {
          if (!pending) return { ok: false, message: "Tidak ada data dipilih." };
          const r = pending.kind === "range" ? await deleteRange(new Date(pending.from).toISOString(), new Date(pending.to).toISOString()) : await deleteRows(pending.items);
          if (r.ok) {
            toast.success(r.message);
            setSelected(new Set());
          }
          return r;
        }}
      />
    </div>
  );
}

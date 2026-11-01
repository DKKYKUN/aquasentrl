import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { Status } from "@/lib/aqua/rules";
import { cn } from "@/lib/utils";

export const statusStyle: Record<Status, { text: string; bg: string; dot: string; label: string }> = {
  NORMAL: { text: "text-normal", bg: "bg-normal-soft", dot: "bg-normal", label: "Normal" },
  WASPADA: { text: "text-warn", bg: "bg-warn-soft", dot: "bg-warn", label: "Waspada" },
  ANOMALI: { text: "text-danger", bg: "bg-danger-soft", dot: "bg-danger", label: "Anomali" },
  "TIDAK CUKUP DATA": { text: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground", label: "Data belum cukup" },
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const s = statusStyle[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.bg, s.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full pulse-dot", s.dot)} />
      {s.label}
    </span>
  );
}

export function Card({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <div className={cn("glass-card rise-in p-5", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function CardTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground md:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      {right}
    </div>
  );
}

export function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  const d = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer>
        <AreaChart data={d} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="flex h-48 items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground shimmer">{text}</div>;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const tooltipStyle = {
  contentStyle: { background: "var(--tooltip)", border: "none", borderRadius: 10, color: "var(--tooltip-foreground)", fontSize: 12 },
  labelStyle: { color: "var(--tooltip-foreground)" },
  itemStyle: { color: "var(--tooltip-foreground)" },
};

import { useEffect as useEffectC, useState as useStateC } from "react";
const FALLBACK = { ph: "#14a7a0", tds: "#3b7fd9", temp: "#e59a3a", normal: "#2ea56b", warn: "#e0a52b", danger: "#d9443b", grid: "#e3ecef", muted: "#7b8a96" };
export type Palette = typeof FALLBACK;
/** Resolves design tokens to concrete colors for SVG chart attributes. */
export function usePalette(): Palette {
  const [p, setP] = useStateC<Palette>(FALLBACK);
  useEffectC(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    setP({ ph: g("--ph", FALLBACK.ph), tds: g("--tds", FALLBACK.tds), temp: g("--temp", FALLBACK.temp), normal: g("--normal", FALLBACK.normal), warn: g("--warn", FALLBACK.warn), danger: g("--danger", FALLBACK.danger), grid: g("--border", FALLBACK.grid), muted: g("--muted-foreground", FALLBACK.muted) });
  }, []);
  return p;
}

/** Overlay shown on top of a chart that has no rows. The chart (axes, grid) stays rendered. */
export function ChartEmpty({ show, text = "Belum ada data sensor" }: { show: boolean; text?: string }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{text}</span>
    </div>
  );
}

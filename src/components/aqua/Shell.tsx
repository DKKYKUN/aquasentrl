import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Activity, BrainCircuit, Database, Info, LayoutDashboard, Menu, RadioTower, Settings, ShieldCheck, Waves, X } from "lucide-react";
import { useAqua } from "@/lib/aqua/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/monitoring", label: "Monitoring Real-Time", icon: Activity },
  { to: "/ai", label: "AI Deteksi Anomali", icon: BrainCircuit },
  { to: "/riwayat", label: "Riwayat & Laporan", icon: Database },
  { to: "/perangkat", label: "Perangkat IoT", icon: RadioTower },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/tentang", label: "Tentang", icon: Info },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { source, sheetsOk, lastSync, engine } = useAqua();
  const [clock, setClock] = useState("");
  useEffect(() => {
    const f = () => setClock(new Date().toLocaleString("id-ID", { weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const dataLabel = source === "unconfigured" ? "Belum dihubungkan" : sheetsOk ? "Terhubung" : source ? "Terputus" : "Menghubungkan";
  const dataColor = source === null ? "bg-warn" : sheetsOk ? "bg-normal" : "bg-danger";

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 p-5">
          <div className="rounded-xl bg-brand p-2 text-primary-foreground shadow-[var(--shadow-card)]"><Waves className="h-5 w-5" /></div>
          <div>
            <p className="font-display text-base font-extrabold tracking-wide">AQUA SENTINEL</p>
            <p className="text-[11px] text-muted-foreground">AIoT Water Monitoring</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n, i) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all rise-in",
                  active ? "bg-brand text-primary-foreground shadow-[var(--shadow-card)]" : "text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-1",
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 space-y-2 rounded-xl bg-muted/70 p-3 text-xs">
          <p className="font-semibold text-foreground">Status Sistem</p>
          <Row label="Aliran data" value={dataLabel} dot={dataColor} />
          <Row
            label="AI Python (di web)"
            value={engine.state === "ready" ? "Aktif" : engine.state === "analyzing" ? "Menganalisis" : engine.state === "waiting" ? "Menunggu data" : engine.state === "loading" ? "Memuat" : engine.state === "unconfigured" ? "Belum dihubungkan" : "Gagal"}
            dot={engine.state === "ready" ? "bg-normal" : engine.state === "analyzing" || engine.state === "waiting" || engine.state === "loading" ? "bg-warn" : "bg-danger"}
          />
          <div className="flex justify-between text-muted-foreground"><span>Sinkron</span><span>{lastSync ? lastSync.toLocaleTimeString("id-ID") : "—"}</span></div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/20 md:hidden fade-in" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur-xl md:px-8">
          <button className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span className={cn("h-2 w-2 rounded-full pulse-dot", dataColor)} />
            {source === "unconfigured" ? "Google Sheets belum dihubungkan — menunggu data sensor" : sheetsOk ? "Data sensor dari Google Sheets" : source ? "Gagal mengambil data dari Google Sheets" : "Menghubungkan ke Google Sheets…"}
          </div>
          <span className="font-mono text-xs text-muted-foreground">{clock}</span>
        </header>
        <main key={pathname} className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function Row({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="flex items-center gap-1.5 font-semibold text-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {value}
      </span>
    </div>
  );
}

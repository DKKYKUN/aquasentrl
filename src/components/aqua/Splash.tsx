import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { useAqua } from "@/lib/aqua/store";

export function Splash() {
  const { engine } = useAqua();
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [p, setP] = useState(8);

  useEffect(() => {
    const tick = setInterval(() => setP((v) => Math.min(100, v + 6 + Math.random() * 10)), 160);
    const leave = setTimeout(() => setLeaving(true), 2400);
    const remove = setTimeout(() => setGone(true), 3000);
    return () => {
      clearInterval(tick);
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, []);

  if (gone) return null;
  const pct = Math.round(Math.min(p, 100));

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background ${leaving ? "splash-leave" : ""}`} style={{ background: "var(--gradient-page)" }}>
      <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-card shadow-[var(--shadow-lift)] float-y bg-card">
        <div className="absolute inset-x-0 bottom-0 transition-all duration-300" style={{ height: `${pct}%` }}>
          <svg className="wave-track slow absolute -top-4 h-6 w-[200%] text-tds/40" viewBox="0 0 200 20" preserveAspectRatio="none">
            <path fill="currentColor" d="M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 V20 H0Z" />
          </svg>
          <svg className="wave-track absolute -top-3 h-5 w-[200%] text-primary" viewBox="0 0 200 20" preserveAspectRatio="none">
            <path fill="currentColor" d="M0 10 Q 25 20 50 10 T 100 10 T 150 10 T 200 10 V20 H0Z" />
          </svg>
          <div className="h-full w-full bg-brand" />
          {[15, 40, 65, 80].map((l, i) => (
            <span key={l} className="bubble absolute bottom-2 h-2 w-2 rounded-full bg-primary-foreground/70" style={{ left: `${l}%`, animationDelay: `${i * 0.6}s` }} />
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-2xl font-extrabold text-foreground mix-blend-difference">{pct}%</span>
        </div>
      </div>
      <div className="mt-8 flex items-center gap-2 rise-in">
        <div className="rounded-xl bg-brand p-2 text-primary-foreground"><Waves className="h-5 w-5" /></div>
        <h1 className="text-2xl font-extrabold tracking-wide text-foreground">AQUA SENTINEL</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground rise-in" style={{ animationDelay: "120ms" }}>
        AIoT Multi-Sensor · Deteksi Dini Anomali Air
      </p>
      <p className="mt-6 text-xs text-muted-foreground fade-in" style={{ animationDelay: "300ms" }}>
        {engine.state === "ready" ? "Mesin AI Python siap" : engine.stage}
      </p>
    </div>
  );
}

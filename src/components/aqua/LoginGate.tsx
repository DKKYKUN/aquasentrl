import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Lock, Waves } from "lucide-react";
import { useAuth } from "@/lib/aqua/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginGate({ children }: { children: ReactNode }) {
  const { status, login } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "in") return <>{children}</>;
  if (status === "checking")
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    setErr(await login(u, p));
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand p-2 text-primary-foreground"><Waves className="h-5 w-5" /></div>
          <div>
            <p className="font-display text-lg font-extrabold">AQUA SENTINEL</p>
            <p className="text-xs text-muted-foreground">Masuk sebagai admin</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="u">Username</Label>
          <Input id="u" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p">Sandi</Label>
          <Input id="p" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required />
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Masuk
        </Button>
      </form>
    </div>
  );
}

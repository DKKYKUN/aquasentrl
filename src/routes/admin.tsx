import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LogOut, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { rpc, useAuth } from "@/lib/aqua/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/aqua/ConfirmDialog";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Aqua Sentinel" },
      { name: "description", content: "Kelola akun admin Aqua Sentinel." },
      { property: "og:title", content: "Admin — Aqua Sentinel" },
      { property: "og:description", content: "Kelola akun admin Aqua Sentinel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { token, username, logout } = useAuth();
  const [list, setList] = useState<{ username: string; created_at: string }[]>([]);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!token) return;
    rpc<{ ok: boolean; admins: { username: string; created_at: string }[] }>("admin_list", { p_token: token })
      .then((r) => setList(r.admins ?? []))
      .catch((e) => toast.error((e as Error).message));
  }, [token]);
  useEffect(reload, [reload]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; message: string }>("admin_add", { p_token: token, p_username: u, p_password: p });
      if (r.ok) { toast.success(r.message); setU(""); setP(""); reload(); } else toast.error(r.message);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const remove = async () => {
    if (!token || !deleting) return { ok: false, message: "Sesi tidak valid." };
    try {
      const result = await rpc<{ ok: boolean; message: string }>("admin_delete", { p_token: token, p_username: deleting });
      if (result.ok) { toast.success(result.message); reload(); }
      return result;
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Admin</h1>
          <p className="text-sm text-muted-foreground">Masuk sebagai <b>{username}</b></p>
        </div>
        <Button variant="outline" onClick={() => void logout()}><LogOut className="h-4 w-4" /> Keluar</Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={add} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Tambah Admin</p>
          <div className="space-y-2"><Label htmlFor="nu">Username</Label><Input id="nu" value={u} onChange={(e) => setU(e.target.value)} required minLength={3} /></div>
          <div className="space-y-2"><Label htmlFor="np">Sandi</Label><Input id="np" type="password" value={p} onChange={(e) => setP(e.target.value)} required minLength={6} autoComplete="new-password" /></div>
          <Button type="submit" disabled={busy}><UserPlus className="h-4 w-4" /> Tambah</Button>
        </form>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 font-semibold">Daftar Admin</p>
          <ul className="divide-y divide-border text-sm">
            {list.map((a) => (
              <li key={a.username} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 break-words font-medium">{a.username}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString("id-ID")}</span>
                  <Button variant="ghost" size="icon" aria-label={`Hapus admin ${a.username}`} title={a.username === username ? "Akun yang sedang dipakai tidak dapat dihapus" : `Hapus admin ${a.username}`} disabled={a.username === username} onClick={() => setDeleting(a.username)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </li>
            ))}
            {!list.length && <li className="py-2 text-muted-foreground">Belum ada data.</li>}
          </ul>
        </div>
      </div>
      <ConfirmDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }} title="Hapus admin?" description={<>Akun <b>{deleting}</b> akan dihapus dan tidak bisa login lagi.</>} confirmLabel="Hapus" destructive onConfirm={remove} />
    </div>
  );
}

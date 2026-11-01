import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { adminSupabase as supabase } from "./config";

/** Login admin lewat fungsi RPC di Supabase milik pengguna (integrations/supabase/admins.sql). */
const KEY = "aqua_admin_token";

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const key = supabase.apikey.trim();
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;
  const res = await fetch(`${supabase.url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 404 || /PGRST202|function/i.test(text)) throw new Error("Fungsi login belum ada. Jalankan integrations/supabase/admins.sql di SQL Editor Supabase.");
    throw new Error(`Supabase merespon status ${res.status}.`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

type AuthCtx = {
  status: "checking" | "out" | "in";
  username: string | null;
  token: string | null;
  login: (u: string, p: string) => Promise<string | null>;
  logout: () => Promise<void>;
};
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthCtx["status"]>("checking");
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem(KEY);
    if (!t) return setStatus("out");
    rpc<{ ok: boolean; username?: string }>("admin_check", { p_token: t })
      .then((r) => {
        if (r.ok) { setToken(t); setUsername(r.username ?? null); setStatus("in"); }
        else { localStorage.removeItem(KEY); setStatus("out"); }
      })
      .catch(() => setStatus("out"));
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    try {
      const r = await rpc<{ ok: boolean; token?: string; username?: string; message?: string }>("admin_login", { p_username: u, p_password: p });
      if (!r.ok || !r.token) return r.message ?? "Login gagal.";
      localStorage.setItem(KEY, r.token);
      setToken(r.token); setUsername(r.username ?? u); setStatus("in");
      return null;
    } catch (e) {
      return (e as Error).message || "Gagal menghubungi Supabase.";
    }
  }, []);

  const logout = useCallback(async () => {
    if (token) await rpc("admin_logout", { p_token: token }).catch(() => {});
    localStorage.removeItem(KEY);
    setToken(null); setUsername(null); setStatus("out");
  }, [token]);

  return <Ctx.Provider value={{ status, username, token, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

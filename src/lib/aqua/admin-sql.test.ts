// Execute the delivered migration in isolated PostgreSQL; no hosted credentials.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const migration = readFileSync("integrations/supabase/admins.sql", "utf8")
  .replace(/create extension if not exists pgcrypto with schema extensions;/i, "");

beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role; create schema extensions;");
  await db.exec(migration);
  await db.exec(`insert into public.admins (username, password_hash) values ('owner', 'test-only'), ('other', 'test-only');
    insert into public.admin_sessions (token, admin_id) select 'owner-test-session', id from public.admins where username = 'owner';`);
}, 30000);
afterAll(async () => { await db.close(); });

describe("Admin SQL rules", () => {
  it("seeds the requested first username DKKY without storing a plaintext password", async () => {
    // Test-only crypto stubs: this test verifies seed identity/upsert, not bcrypt.
    await db.exec(`create or replace function extensions.gen_salt(text) returns text language sql as $$ select 'test-salt'::text $$;
      create or replace function extensions.crypt(text, text) returns text language sql as $$ select 'test-hash'::text $$;`);
    const seed = readFileSync("integrations/supabase/initial_admin.sql", "utf8");
    await expect(db.exec(seed)).rejects.toThrow("Isi sandi admin pertama");
    await db.exec(seed.replace("initial_password text := 'ISI_SANDI_ANDA_DI_SINI'", "initial_password text := 'test-only-password'"));
    expect((await db.query("select username from public.admins where username = 'DKKY'")).rows).toEqual([{ username: "DKKY" }]);
    await db.exec(seed.replace("initial_password text := 'ISI_SANDI_ANDA_DI_SINI'", "initial_password text := 'test-only-password'"));
    expect((await db.query("select username from public.admins where username = 'DKKY'")).rows).toHaveLength(1);
  });

  it("keeps sessions valid beyond seven days without an expiry", async () => {
    const r = await db.query<{ unlimited: boolean }>("select expires_at = 'infinity'::timestamptz and expires_at > now() + interval '7 days' as unlimited from public.admin_sessions");
    expect(r.rows[0]?.unlimited).toBe(true);
  });

  it("updates existing seven-day sessions to unlimited on rerun", async () => {
    await db.exec("update public.admin_sessions set expires_at = now() + interval '7 days';");
    await db.exec(migration);
    const r = await db.query<{ unlimited: boolean }>("select expires_at = 'infinity'::timestamptz as unlimited from public.admin_sessions");
    expect(r.rows[0]?.unlimited).toBe(true);
  });

  it("rejects admin deletion without a valid session", async () => {
    const r = await db.query<{ result: { ok: boolean } }>("select public.admin_delete('invalid', 'other') as result");
    expect(r.rows[0]?.result.ok).toBe(false);
    expect((await db.query("select id from public.admins where username = 'other'")).rows).toHaveLength(1);
  });

  it("does not delete the signed-in admin", async () => {
    const r = await db.query<{ result: { ok: boolean } }>("select public.admin_delete('owner-test-session', 'owner') as result");
    expect(r.rows[0]?.result.ok).toBe(false);
  });

  it("deletes another admin and revokes their sessions", async () => {
    await db.exec("insert into public.admin_sessions(token, admin_id) select 'other-test-session', id from public.admins where username = 'other';");
    const r = await db.query<{ result: { ok: boolean } }>("select public.admin_delete('owner-test-session', 'other') as result");
    expect(r.rows[0]?.result.ok).toBe(true);
    expect((await db.query("select id from public.admins where username = 'other'")).rows).toHaveLength(0);
    const checked = await db.query<{ result: { ok: boolean } }>("select public.admin_check('other-test-session') as result");
    expect(checked.rows[0]?.result.ok).toBe(false);
  });

  it("ends even an unlimited session on logout", async () => {
    await db.exec("select public.admin_logout('owner-test-session');");
    const checked = await db.query<{ result: { ok: boolean } }>("select public.admin_check('owner-test-session') as result");
    expect(checked.rows[0]?.result.ok).toBe(false);
  });
});
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- ML runs in a browser Web Worker via Pyodide (src/lib/aqua/ai.worker.ts) and is triggered automatically when new sheet rows arrive — the user wants Python AI inside the web, no external AI server.
- Keep independent settings (`supabase`), login (`adminSupabase`), and Sheets connections in src/lib/aqua/config.ts so changing the settings project never changes admin authentication; browser database keys must be publishable/anon only.
- Custom admin RPCs validate database-backed sessions for every admin operation and deny direct browser access to credentials; deletion cascades sessions and blocks removing the caller to preserve access.
- Sensor data lives only in Google Sheets via the Apps Script in integrations/google-apps-script, reached through server functions in sheets.functions.ts; no demo/fallback data anywhere.
- App settings live only in the user's own Supabase table app_settings (integrations/supabase/app_settings.sql grants anon read/insert/update); no localStorage.
- There is NO admin PIN anywhere (the user asked to remove it). Deleting rows only asks a simple Batal/Hapus confirmation (ConfirmDialog); deletes go to the Apps Script, which verifies row timestamps. Do not reintroduce a PIN.
- Charts always render (with an empty overlay) even when no data remains.

/**
 * Konfigurasi koneksi Aqua Sentinel — cukup edit file ini.
 *
 * 1) Supabase  → tempat pengaturan (ambang batas, interval) disimpan.
 *    Jalankan integrations/supabase/app_settings.sql sekali di SQL Editor Supabase.
 *    `apikey` di sini adalah anon/publishable key (memang aman dipakai di browser).
 *
 * 2) Google Sheets → tempat data sensor disimpan.
 *    Tempel URL Web App Apps Script (berakhiran /exec) di `sheets.url`.
 *    `sheets.token` boleh dikosongkan; isi hanya jika Script property API_TOKEN dipakai.
 */

/** Koneksi khusus pengaturan. */
export const supabase = {
  url: "https://xjdqwtqvibnumyuuqzfd.supabase.co",
  apikey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHF3dHF2aWJudW15dXVxemZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MzM1NTUsImV4cCI6MjEwOTEwOTU1NX0.BLyRBtAeZcF2YCjBWg4kG8DJ0xzwiW8u4mKKizULhrA",
};

/** Koneksi khusus login dan pengelolaan admin, terpisah dari pengaturan. */
export const adminSupabase = {
  url: "https://pqcmsgljwdvtzpagllwg.supabase.co",
  apikey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxY21zZ2xqd2R2dHpwYWdsbHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MzQyMzAsImV4cCI6MjEwOTExMDIzMH0.LSKfEMgxsC9NSDXGCrkdpGsZH4YjNXoCWTUgVbOpCIA",
};

export const sheets = {
  /** URL Web App Apps Script, contoh: https://script.google.com/macros/s/XXXX/exec */
  url: "https://script.google.com/macros/s/AKfycbz3UPhGqGnnft74qjW6Gw07anXfzFk-dcCqWRgx1Rkv07kcWRnrGQ6N1_DMmTdrKqlt/exec",
  /** Opsional. Samakan dengan Script property API_TOKEN bila dipakai. */
  token: "",
};

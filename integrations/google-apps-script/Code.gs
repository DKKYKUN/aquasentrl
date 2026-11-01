/**
 * Aqua Sentinel — Google Apps Script Web App (Google Sheets = database sensor).
 *
 * Cara pasang (±2 menit):
 *  1. Buka spreadsheet → Extensions → Apps Script, tempel seluruh file ini.
 *  2. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *  3. Salin URL yang berakhiran /exec → tempel ke `sheets.url` di src/lib/aqua/config.ts.
 *
 * Opsional (Project Settings → Script properties):
 *   API_TOKEN       = string rahasia. Bila diisi, isi juga `sheets.token` di config.ts
 *                     (dan token yang sama di ESP32). Bila kosong, tidak ada token.
 *   SHEET_NAME      = nama tab data (default: tab pertama).
 *   SPREADSHEET_ID  = hanya jika script dibuat terpisah (bukan dari menu Extensions).
 *
 * Baris 1 harus header. Nama kolom yang dikenali (tidak peka huruf besar/kecil):
 *   timestamp | waktu | time | tanggal,  ph,  tds,  temperature | suhu | temp
 *
 * GET  ?action=history&offset=0&limit=1000[&token=…] → { ok, total, offset, rows:[{row,timestamp,ph,tds,temperature}] }
 * GET  ?action=ping[&token=…]                        → { ok, total, columns }
 * POST {action:"append", [token,] ph, tds, temperature[, timestamp]}   (untuk ESP32)
 * POST {action:"delete", [token,] items:[{row,timestamp}]}  → hanya menghapus baris yang timestamp-nya masih cocok
 * POST {action:"deleteRange", [token,] from, to}            → hapus baris dengan from <= timestamp <= to
 */

function props_() { return PropertiesService.getScriptProperties(); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_() {
  var name = props_().getProperty('SHEET_NAME');
  var id = props_().getProperty('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet tidak ditemukan. Buat script dari Extensions → Apps Script, atau isi SPREADSHEET_ID.');
  var sh = name ? ss.getSheetByName(name) : ss.getSheets()[0];
  if (!sh) throw new Error('Sheet "' + name + '" tidak ditemukan.');
  return sh;
}
function auth_(token) {
  var want = props_().getProperty('API_TOKEN');
  if (!want) return; // token tidak dipakai (mode mudah)
  if (String(token || '') !== want) throw new Error('Token tidak valid.');
}
function cols_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error('Sheet kosong, header belum ada.');
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var m = {};
  var alias = { timestamp: ['timestamp', 'waktu', 'time', 'tanggal', 'datetime'], ph: ['ph'], tds: ['tds', 'tds_ppm'], temperature: ['temperature', 'suhu', 'temp', 'suhu_c'] };
  head.forEach(function (h, i) {
    var k = String(h).trim().toLowerCase();
    Object.keys(alias).forEach(function (key) { if (m[key] === undefined && alias[key].indexOf(k) >= 0) m[key] = i; });
  });
  ['timestamp', 'ph', 'tds', 'temperature'].forEach(function (k) { if (m[k] === undefined) throw new Error('Kolom "' + k + '" tidak ditemukan di header.'); });
  m.width = lastCol;
  m.header = head;
  return m;
}
function iso_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  if (v === '' || v === null || v === undefined) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function num_(v) {
  if (typeof v === 'number') return v;
  var n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}
function dataCount_(sh) { return Math.max(0, sh.getLastRow() - 1); }

function doGet(e) {
  try {
    var p = e.parameter || {};
    auth_(p.token);
    var sh = sheet_();
    var c = cols_(sh);
    var total = dataCount_(sh);
    if (p.action === 'ping') return out_({ ok: true, total: total, columns: c.header });
    if (p.action !== 'history') return out_({ ok: false, error: 'action tidak dikenal.' });
    var offset = Math.max(0, parseInt(p.offset || '0', 10) || 0);
    var limit = Math.min(1000, Math.max(1, parseInt(p.limit || '1000', 10) || 1000));
    var rows = [];
    if (offset < total) {
      var n = Math.min(limit, total - offset);
      var values = sh.getRange(2 + offset, 1, n, c.width).getValues();
      for (var i = 0; i < values.length; i++) {
        var v = values[i];
        rows.push({ row: 2 + offset + i, timestamp: iso_(v[c.timestamp]), ph: num_(v[c.ph]), tds: num_(v[c.tds]), temperature: num_(v[c.temperature]) });
      }
    }
    return out_({ ok: true, total: total, offset: offset, rows: rows });
  } catch (err) {
    return out_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    auth_(body.token);
    lock.waitLock(20000);
    var sh = sheet_();
    var c = cols_(sh);

    if (body.action === 'append') {
      var row = new Array(c.width).fill('');
      row[c.timestamp] = body.timestamp ? new Date(body.timestamp) : new Date();
      row[c.ph] = Number(body.ph); row[c.tds] = Number(body.tds); row[c.temperature] = Number(body.temperature);
      if ([row[c.ph], row[c.tds], row[c.temperature]].some(isNaN)) return out_({ ok: false, error: 'ph/tds/temperature harus angka.' });
      sh.appendRow(row);
      return out_({ ok: true });
    }

    var total = dataCount_(sh);
    var ts = total ? sh.getRange(2, c.timestamp + 1, total, 1).getValues().map(function (r) { return iso_(r[0]); }) : [];
    var targets = [];
    var skipped = 0;

    if (body.action === 'delete') {
      var items = body.items || [];
      if (!items.length || items.length > 20000) return out_({ ok: false, error: 'Daftar baris tidak valid.' });
      items.forEach(function (it) {
        var r = parseInt(it.row, 10);
        // Only delete when the row still holds the same reading the user selected.
        if (r >= 2 && r <= total + 1 && ts[r - 2] && ts[r - 2] === iso_(it.timestamp)) targets.push(r);
        else skipped++;
      });
    } else if (body.action === 'deleteRange') {
      var from = iso_(body.from), to = iso_(body.to);
      if (!from || !to || from > to) return out_({ ok: false, error: 'Rentang tanggal tidak valid.' });
      ts.forEach(function (t, i) { if (t && t >= from && t <= to) targets.push(i + 2); });
    } else {
      return out_({ ok: false, error: 'action tidak dikenal.' });
    }

    // Unique, bottom-up so row numbers stay valid. Row 1 (header) is never touched.
    targets = targets.filter(function (r, i, a) { return r >= 2 && a.indexOf(r) === i; }).sort(function (a, b) { return b - a; });
    var i = 0;
    while (i < targets.length) {
      var end = targets[i], start = end, j = i + 1;
      while (j < targets.length && targets[j] === start - 1) { start--; j++; }
      sh.deleteRows(start, end - start + 1);
      i = j;
    }
    return out_({ ok: true, deleted: targets.length, skipped: skipped });
  } catch (err) {
    return out_({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

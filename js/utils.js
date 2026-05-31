/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Shared Utilities
   ═══════════════════════════════════════════════════════════ */

/**
 * Escapes HTML special characters to prevent XSS injection.
 * Must be applied to ALL untrusted strings before inserting into innerHTML.
 */
function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Parses a CSV string (with header row) into an array of objects. */
function parseCSV(csv) {
  var lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  var headers = lines[0].split(',');
  return lines.slice(1).map(function(row) {
    var vals = row.split(','), obj = {};
    headers.forEach(function(h, i) { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  }).filter(function(f) { return +f.latitude && +f.longitude; });
}

/** Returns today in YYYY-MM-DD (UTC). */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/** Returns the date N days ago in YYYY-MM-DD (UTC). */
function daysAgoISO(n) {
  return new Date(Date.now() - n * 864e5).toISOString().split('T')[0];
}

/**
 * Formats an ISO date string as a French short date: "11 Mar 2026".
 * Safe to call with null/undefined — returns empty string.
 */
function fmtDate(iso) {
  if (!iso) return '';
  var months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  var parts = iso.split('-');
  return (parseInt(parts[2], 10)) + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}

/** Returns today as a French long-form date: "31 mai 2026". */
function todayFR() {
  var n = new Date();
  var months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return n.getDate() + ' ' + months[n.getMonth()] + ' ' + n.getFullYear();
}

/** Truncates s to maxLen chars, appending '…' if truncated. */
function trunc(s, maxLen) {
  if (!s) return '';
  s = String(s);
  return s.length > maxLen ? s.substring(0, maxLen) + '…' : s;
}

/**
 * Downloads an array of event objects as a UTF-8 CSV file.
 * Handles quoting for fields containing commas, quotes, or newlines.
 */
function exportCSV(data, filename) {
  if (!data || !data.length) {
    if (window.toast) toast('Aucun événement à exporter.', 'warn');
    return;
  }
  filename = filename || ('sentinelle-export-' + todayISO() + '.csv');
  var cols = ['src','type','subtype','date','time','location','admin1','lat','lon',
              'fatalities','actor1','actor2','notes','platform','status','id'];
  var rows = [cols.join(',')].concat(data.map(function(e) {
    return cols.map(function(c) {
      var v = e[c] != null ? String(e[c]) : '';
      return (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1)
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;
    }).join(',');
  }));
  var blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  if (window.toast) toast('Export: ' + data.length + ' événements → ' + filename, 'success');
}

/**
 * Shared utility functions.
 * All functions are pure and have no side effects.
 */

/** Returns today's date in YYYY-MM-DD (UTC). */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns the date N days ago in YYYY-MM-DD (UTC). */
export function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().split('T')[0];
}

/** Formats an ISO date as French short form: "11 Mar 2026". */
export function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

/** Returns today as a French long-form date: "31 mai 2026". */
export function todayFR(): string {
  const n = new Date();
  const months = ['janvier','février','mars','avril','mai','juin','juillet',
                  'août','septembre','octobre','novembre','décembre'];
  return `${n.getDate()} ${months[n.getMonth()]} ${n.getFullYear()}`;
}

/** Truncates s to maxLen characters, appending '…' if truncated. */
export function trunc(s: string | undefined, maxLen: number): string {
  if (!s) return '';
  return s.length > maxLen ? `${s.substring(0, maxLen)}…` : s;
}

/**
 * Downloads data as a UTF-8 CSV file.
 * Handles quoting for fields containing commas, quotes, or newlines.
 */
export function exportCSV(data: Record<string, unknown>[], filename?: string): void {
  if (!data.length) return;
  const file = filename ?? `sentinelle-export-${todayISO()}.csv`;
  const cols = ['src','type','subtype','date','time','location','admin1','lat','lon',
                'fatalities','actor1','actor2','notes','platform','status','id'];
  const rows = [
    cols.join(','),
    ...data.map(e =>
      cols.map(c => {
        const v = e[c] != null ? String(e[c]) : '';
        return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    ),
  ];
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: file });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parses a CSV string (header row required) into an array of objects. */
export function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? '').trim(); });
    return obj;
  }).filter(f => f['latitude'] && f['longitude']);
}

/** Generates a cryptographically random hex string of `bytes` bytes. */
export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

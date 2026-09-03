'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Anomaly Panel
   ═══════════════════════════════════════════════════════════════════════

   Two detectors surfaced side by side:

   • Mobile connectivity per province, plotted against its own learned
     hour-of-day baseline. The baseline curve is drawn explicitly, because
     the single most common way to misread this signal is to see the
     nightly trough and call it an outage.

   • Emerging spatio-temporal concentrations from the scan statistic,
     split into findings and watch items — a candidate that has not
     cleared significance is shown, and shown as not having cleared it.
   ═══════════════════════════════════════════════════════════════════════ */

import { useFusionStore } from '@/store/useFusionStore';
import { isOutage, type ProvinceMonitor } from '@/lib/fusion/anomaly';
import { flyTo } from '@/lib/mapController';
import { settlementsWithin } from '@/lib/fusion/geo';

/* ── Connectivity sparkline with baseline overlay ───────────────── */

function ConnectivityChart({ mon }: { mon: ProvinceMonitor }) {
  const W = 300, H = 62;
  const samples = mon.history.slice(-72);
  if (samples.length < 4) {
    return <div className="text-t3 text-3xs font-mono">Ligne de base en apprentissage…</div>;
  }

  const values = samples.map((s) => s.value);
  const baselineCurve = samples.map((s) => {
    const d = s.at;
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    return mon.detector.baseline(weekend)[d.getUTCHours()];
  });

  const mx = Math.max(...values, ...baselineCurve, 1);
  const x = (i: number) => (i / Math.max(1, samples.length - 1)) * W;
  const y = (v: number) => H - 4 - (v / mx) * (H - 10);

  const linePts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const basePts = baselineCurve.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  const outage = isOutage(mon);
  const stroke = outage ? '#e03030' : mon.lastHit ? '#d09820' : '#18c8e0';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block" preserveAspectRatio="none">
      {/* Learned seasonal baseline */}
      <polyline points={basePts} fill="none" stroke="#445870" strokeWidth="1" strokeDasharray="3 2" />
      {/* Observed */}
      <polyline points={linePts} fill="none" stroke={stroke} strokeWidth="1.4" />
      {/* Anomalous samples */}
      {samples.map((s, i) => {
        const b = baselineCurve[i];
        if (!b) return null;
        const dev = Math.abs(s.value - b) / Math.max(1, b);
        if (dev < 0.32) return null;
        return <circle key={i} cx={x(i)} cy={y(s.value)} r="1.6" fill={stroke} />;
      })}
    </svg>
  );
}

export default function AnomalyPanel() {
  const monitors = useFusionStore((s) => s.monitors);
  const clusters = useFusionStore((s) => s.clusters);
  const injectOutage = useFusionStore((s) => s.injectOutage);
  const runScan = useFusionStore((s) => s.runScan);
  const lastScanMs = useFusionStore((s) => s.lastScanMs);

  const significant = clusters.filter((c) => c.significant);
  const watch = clusters.filter((c) => !c.significant);

  return (
    <div className="h-full overflow-y-auto min-h-0 p-3 space-y-3 bg-b0">

      {/* ── Spatio-temporal clusters ── */}
      <div className="border border-b3 bg-b1 p-2.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="mvn-label">CONCENTRATIONS SPATIO-TEMPORELLES</span>
          <button
            onClick={runScan}
            className="ml-auto border border-pur/40 text-pur px-1.5 py-0.5 text-3xs font-mono hover:bg-pur/15 transition-colors"
          >
            RELANCER
          </button>
        </div>
        <div className="text-t3 text-3xs font-mono mb-2 leading-tight">
          Balayage cylindrique de Kulldorff sur les 7 derniers jours, ligne de base des
          8–60 jours précédents. La p-value porte sur le <em>maximum</em> de vraisemblance
          parmi tous les cylindres testés — elle paie donc le coût des tests multiples.
          {lastScanMs > 0 && ` Dernier balayage : ${lastScanMs} ms.`}
        </div>

        {!clusters.length && (
          <div className="text-t2 text-2xs font-mono">
            Aucune concentration au-delà de la variation attendue.
          </div>
        )}

        <div className="space-y-1.5">
          {[...significant, ...watch].map((c, i) => {
            const near = settlementsWithin(c.lat, c.lon, c.radius_km).slice(0, 3);
            const where = near.length > 1
              ? `axe ${near.map((p) => p.name).join('–')}`
              : near[0]?.name ?? `${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}`;
            return (
              <button
                key={i}
                onClick={() => flyTo({ longitude: c.lon, latitude: c.lat, zoom: 8.5 })}
                className={`w-full text-left border p-2 transition-colors ${
                  c.significant
                    ? 'border-alert/40 bg-alert/[0.06] hover:bg-alert/10'
                    : 'border-amb/30 bg-amb/[0.03] hover:bg-amb/[0.07]'
                }`}
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={`text-2xs font-mono font-bold ${c.significant ? 'text-alert' : 'text-amb'}`}>
                    {c.significant ? '◈ SIGNIFICATIF' : '○ À SURVEILLER'}
                  </span>
                  <span className="text-t1 text-2xs font-mono truncate">{where}</span>
                  <span className="text-t3 text-3xs font-mono ml-auto">
                    rayon {c.radius_km} km · fenêtre {c.window_h} h
                  </span>
                </div>
                <div className="text-t2 text-3xs font-mono mt-0.5">
                  {c.events} événements · observé <span className="text-t1">{c.observed}</span> vs
                  attendu <span className="text-t1">{c.expected}</span> ·
                  risque relatif <span className={c.significant ? 'text-alert' : 'text-amb'}>×{c.rr}</span> ·
                  LLR {c.llr} · p = {c.p}
                  {!c.significant && <span className="text-t3"> — non significatif après correction</span>}
                </div>
                {near[0]?.territory && (
                  <div className="text-t3 text-3xs font-mono">
                    {near[0].territory}, {near[0].province}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Connectivity ── */}
      <div className="border border-b3 bg-b1 p-2.5">
        <div className="mvn-label mb-1">CONNECTIVITÉ MOBILE PAR PROVINCE</div>
        <div className="text-t3 text-3xs font-mono mb-2 leading-tight">
          Z-score robuste contre une ligne de base heure-du-jour × week-end (pointillés).
          Une coupure n&apos;est déclarée qu&apos;après trois relevés consécutifs sous le
          seuil — sans cette hystérésis, le creux nocturne normal déclencherait une alerte
          chaque nuit.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {monitors.map((m) => {
            const out = isOutage(m);
            const hit = m.lastHit;
            const latest = m.history[m.history.length - 1];
            return (
              <div
                key={m.province}
                className={`border p-2 ${out ? 'border-alert/50 bg-alert/[0.06]' : 'border-b3 bg-b0'}`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-t1 text-2xs font-mono font-bold">{m.province}</span>
                  <span
                    className={`text-3xs font-mono ml-auto border px-1 ${
                      out ? 'text-alert border-alert/40'
                        : hit ? 'text-amb border-amb/40'
                        : 'text-grn border-grn/40'
                    }`}
                  >
                    {out ? 'DÉGRADÉ' : hit ? 'SURVEILLÉ' : 'NOMINAL'}
                  </span>
                </div>
                <div className="text-t2 text-3xs font-mono">
                  {latest ? `${latest.value} k abonnés actifs` : '—'}
                  {hit && (
                    <span className={out ? 'text-alert' : 'text-amb'}>
                      {' '}· z = {hit.z} · attendu {Math.round(hit.expected)} k
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <ConnectivityChart mon={m} />
                </div>
                {out && (
                  <div className="text-alert text-3xs font-mono mt-0.5">
                    Chute de {hit ? Math.round((1 - hit.value / Math.max(1, hit.expected)) * 100) : '?'} % ·
                    {' '}{m.runLength} relevés consécutifs · collecte réduite dans cette province
                  </div>
                )}
                <button
                  onClick={() => injectOutage(m.province)}
                  className="text-3xs font-mono text-t3 hover:text-amb mt-1 transition-colors"
                  title="Simule une coupure de 6 h pour vérifier la réaction du détecteur"
                >
                  ⚡ simuler une coupure
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

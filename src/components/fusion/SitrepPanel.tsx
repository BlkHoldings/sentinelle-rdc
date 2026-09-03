'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — SITREP Panel
   ═══════════════════════════════════════════════════════════════════════

   Generates the situation report from the current fused window and lets
   the analyst export it. Everything in the output is computed — there is
   no boilerplate trend text — and the panel shows the parameters that
   produced it so the report is reproducible.
   ═══════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import { useFusionStore } from '@/store/useFusionStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { generateSitrep } from '@/lib/fusion/sitrep';
import { MONITORED_PROVINCES } from '@/lib/fusion/sources';

const PERIODS = [
  { h: 24,  label: '24 H' },
  { h: 72,  label: '72 H' },
  { h: 168, label: '7 J' },
];

export default function SitrepPanel() {
  const events = useFusionStore((s) => s.events);
  const monitors = useFusionStore((s) => s.monitors);
  const session = useAuthStore((s) => s.session);
  const push = useToastStore((s) => s.push);

  const [periodH, setPeriodH] = useState(24);
  const [province, setProvince] = useState<string>('');
  const [minConf, setMinConf] = useState(0.45);

  const sitrep = useMemo(
    () => generateSitrep(events, {
      periodHours: periodH,
      province: province || undefined,
      minConfidence: minConf,
      analyst: session?.user?.toUpperCase() ?? 'ANALYSTE',
      monitors,
      classification: 'SECRET // REL TO USA, COD, UNMISS',
    }),
    [events, periodH, province, minConf, session, monitors],
  );

  const download = (ext: 'txt' | 'json') => {
    const body = ext === 'txt'
      ? sitrep.text
      : JSON.stringify({ ...sitrep, text: undefined }, null, 2);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '');
    const blob = new Blob([body], {
      type: ext === 'txt' ? 'text/plain;charset=utf-8' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `SITREP-${province || 'EST-RDC'}-${stamp}.${ext}`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    push(`SITREP exporté (.${ext})`, 'success');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sitrep.text);
      push('SITREP copié dans le presse-papiers', 'success');
    } catch {
      push('Copie refusée par le navigateur', 'warn');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-b0">

      {/* ── Controls ── */}
      <div className="shrink-0 border-b border-b3 bg-b1 p-2.5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-t1 text-2xs font-mono font-bold tracking-widest">
            RAPPORT DE SITUATION
          </span>

          <div className="flex gap-0.5 ml-2">
            {PERIODS.map((p) => (
              <button
                key={p.h}
                onClick={() => setPeriodH(p.h)}
                className={`px-1.5 py-0.5 text-3xs font-mono border transition-colors ${
                  periodH === p.h ? 'border-blu text-t1 bg-blu/15' : 'border-b3 text-t3 hover:text-t2'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="bg-b0 border border-b3 text-t2 text-3xs font-mono px-1.5 py-0.5 outline-none focus:border-blu"
          >
            <option value="">Toute la zone d&apos;opérations</option>
            {MONITORED_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-3xs font-mono text-t3">
            seuil de confiance
            <input
              type="range" min={0} max={0.9} step={0.05}
              value={minConf}
              onChange={(e) => setMinConf(Number(e.target.value))}
              className="w-20 accent-blu"
            />
            <span className="text-t1 w-8">{(minConf * 100).toFixed(0)}%</span>
          </label>

          <div className="flex gap-1 ml-auto">
            <button
              onClick={copy}
              className="border border-b3 text-t2 hover:text-t1 px-2 py-0.5 text-2xs font-mono transition-colors"
            >
              ⧉ COPIER
            </button>
            <button
              onClick={() => download('txt')}
              className="border border-cyn/40 text-cyn hover:bg-cyn/15 px-2 py-0.5 text-2xs font-mono transition-colors"
            >
              ↓ .TXT
            </button>
            <button
              onClick={() => download('json')}
              className="border border-pur/40 text-pur hover:bg-pur/15 px-2 py-0.5 text-2xs font-mono transition-colors"
            >
              ↓ .JSON
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-1.5 text-3xs font-mono">
          <Chip label="ÉVÉNEMENTS" value={sitrep.counts.total} />
          <Chip label="CONFIRMÉS" value={sitrep.counts.confirmed} cls="text-grn" />
          <Chip label="CORROBORÉS" value={sitrep.counts.corroborated} cls="text-cyn" />
          <Chip label="NON VÉRIFIÉS" value={sitrep.counts.unverified} cls="text-t3" />
          <Chip label="CONTESTÉS" value={sitrep.counts.disputed} cls="text-amb" />
          <Chip
            label="DÉCÈS"
            value={
              sitrep.counts.fatalitiesRange[1] > sitrep.counts.fatalitiesRange[0]
                ? `${sitrep.counts.fatalities} [${sitrep.counts.fatalitiesRange[0]}–${sitrep.counts.fatalitiesRange[1]}]`
                : sitrep.counts.fatalities
            }
            cls="text-alert"
          />
          <Chip
            label="CONCENTRATIONS"
            value={`${sitrep.clusters.filter((c) => c.significant).length} sig. / ${sitrep.clusters.length}`}
            cls="text-pur"
          />
          <Chip
            label="TENDANCES SIG."
            value={`${sitrep.trends.filter((t) => t.significant).length} / ${sitrep.trends.length}`}
          />
        </div>
      </div>

      {/* ── Rendered report ── */}
      <div className="flex-1 overflow-auto min-h-0 p-3">
        <pre className="text-t2 text-2xs font-mono leading-relaxed whitespace-pre-wrap">
          {sitrep.text}
        </pre>
      </div>
    </div>
  );
}

function Chip({ label, value, cls }: { label: string; value: string | number; cls?: string }) {
  return (
    <span className="border border-b3 px-1.5 py-0.5">
      <span className="text-t3">{label} </span>
      <span className={cls ?? 'text-t1'}>{value}</span>
    </span>
  );
}

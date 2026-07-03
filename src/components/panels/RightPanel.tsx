'use client';

import { useMemo } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useFeedStore } from '@/store/useFeedStore';
import { DRONE_ISR } from '@/data/drones';
import { toMGRSSync } from '@/lib/mgrs';
import { SECTIONS } from '@/components/hud/IntelAssessmentPanel';
import type { ViewKey } from '@/components/layout/Sidebar';
import type { IntelEvent } from '@/types/intel';

interface Props { activeView: ViewKey; }

const TYPE_COLOR: Record<string, string> = {
  'Battles':                    'text-alert',
  'Explosions/Remote violence': 'text-mag',
  'Violence against civilians': 'text-amb',
  'Strategic developments':     'text-grn',
};

const TYPE_BAR: Record<string, string> = {
  'Battles':                    'bg-alert',
  'Explosions/Remote violence': 'bg-mag',
  'Violence against civilians': 'bg-amb',
  'Strategic developments':     'bg-grn',
};

function priorityOf(e: IntelEvent): 'HIGH' | 'MED' | 'LOW' {
  if ((e.fatalities ?? 0) >= 10 || e.type === 'Battles') return 'HIGH';
  if ((e.fatalities ?? 0) >= 3  || e.type === 'Explosions/Remote violence') return 'MED';
  return 'LOW';
}

const PRIO_STYLE: Record<string, { label: string; color: string; border: string; bg: string }> = {
  HIGH: { label: 'HIGH PRIORITY', color: 'text-alert', border: 'border-alert/40', bg: 'bg-alert/10' },
  MED:  { label: 'MED PRIORITY',  color: 'text-amb',   border: 'border-amb/40',   bg: 'bg-amb/10'   },
  LOW:  { label: 'LOW PRIORITY',  color: 'text-grn',   border: 'border-grn/40',   bg: 'bg-grn/10'   },
};

function incidentId(e: IntelEvent): string {
  const n = (Math.abs(e.lat * 100 + e.lon * 10) | 0) % 99999;
  return `${e.src.toUpperCase().slice(0, 3)}-${n.toString().padStart(5, '0')}`;
}

function SparkLine({ data, max }: { data: number[]; max: number }) {
  const W = 240;
  const H = 36;
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? W / 2 : (i / (data.length - 1)) * W;
    const y = H - 2 - (v / Math.max(max, 1)) * (H - 4);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline fill="none" stroke="rgba(224,48,48,0.25)" strokeWidth="6" points={pts} />
      <polyline fill="none" stroke="#e03030" strokeWidth="1.5" points={pts} strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = data.length === 1 ? W / 2 : (i / (data.length - 1)) * W;
        const y = H - 2 - (v / Math.max(max, 1)) * (H - 4);
        return v > 0 ? <circle key={i} cx={x} cy={y} r="2.5" fill="#e03030" /> : null;
      })}
    </svg>
  );
}

function EntityNetwork() {
  const nodes = [
    { x: 75,  y: 55,  r: 9,  color: '#e03030', label: 'M23'     },
    { x: 160, y: 38,  r: 7,  color: '#c83048', label: 'RDF'     },
    { x: 225, y: 75,  r: 5,  color: '#c83048', label: 'ADF'     },
    { x: 45,  y: 108, r: 7,  color: '#1e70f0', label: 'FARDC'   },
    { x: 128, y: 120, r: 5,  color: '#1e70f0', label: 'WAZA'    },
    { x: 195, y: 140, r: 4,  color: '#20c880', label: 'MONUSCO' },
    { x: 255, y: 55,  r: 4,  color: '#d09820', label: 'CODECO'  },
    { x: 85,  y: 158, r: 3,  color: '#18c8e0', label: 'ISR'     },
  ];
  const edges = [[0,1],[0,2],[0,4],[1,0],[2,6],[3,4],[3,7],[4,5],[5,7],[6,2]];

  return (
    <svg width="100%" height="175" viewBox="0 0 280 175" className="bg-b0 border border-b3">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="#1a2e42" strokeWidth="1"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r + 4} fill={n.color} fillOpacity="0.12" />
          <circle cx={n.x} cy={n.y} r={n.r}     fill={n.color} fillOpacity="0.85" />
          <text
            x={n.x} y={n.y + n.r + 9}
            textAnchor="middle"
            fill="#445870"
            fontSize="6.5"
            fontFamily="monospace"
            fontWeight="700"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function RightPanel({ activeView }: Props) {
  const feat          = useMapStore((s) => s.selectedFeature);
  const selectFeature = useMapStore((s) => s.selectFeature);
  const events        = useFeedStore((s) => s.events);

  const acledEvents = useMemo(() => events.filter((e) => e.src === 'acled'), [events]);
  const totalKIA    = useMemo(() => events.reduce((a, e) => a + (e.fatalities ?? 0), 0), [events]);
  const strikes     = DRONE_ISR.filter((r) => r.classification === 'strike').length;

  // Threat breakdown
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    acledEvents.forEach((e) => { counts[e.type] = (counts[e.type] ?? 0) + 1; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, pct: Math.round((count / total) * 100) }));
  }, [acledEvents]);

  // Sparkline: events per day last 7 days
  const sparkData = useMemo(() => {
    const buckets = Array(7).fill(0);
    const now = new Date();
    acledEvents.forEach((e) => {
      if (!e.date) return;
      const diff = Math.floor((now.getTime() - new Date(e.date).getTime()) / 86_400_000);
      if (diff >= 0 && diff < 7) buckets[6 - diff]++;
    });
    return buckets;
  }, [acledEvents]);

  const maxSpark = Math.max(...sparkData, 1);

  // Feature details
  const mgrs = feat ? toMGRSSync(feat.lat, feat.lon) : '';
  const prio = feat ? priorityOf(feat) : 'LOW';
  const ps   = PRIO_STYLE[prio];

  return (
    <div className="flex flex-col w-[300px] shrink-0 bg-b1 border-l border-b3 overflow-y-auto">

      {/* INCIDENT / SITUATION HEADER */}
      {feat ? (
        <div className="shrink-0 border-b border-b3">
          {/* Header row */}
          <div className="panel-header px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="mvn-label text-t3 shrink-0">INCIDENT</span>
              <span className="text-t2 text-2xs font-mono font-bold truncate">{incidentId(feat)}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-2xs font-mono font-bold px-1.5 py-0.5 border ${ps.bg} ${ps.border} ${ps.color}`}>
                {ps.label}
              </span>
              <button onClick={() => selectFeature(null)} className="text-t3 hover:text-t1 text-sm transition-colors ml-1">
                ✕
              </button>
            </div>
          </div>

          {/* Incident body */}
          <div className="px-3 py-3 space-y-2">
            <div className={`text-xs font-mono font-bold ${TYPE_COLOR[feat.type] ?? 'text-t1'}`}>
              {feat.type.toUpperCase()}
            </div>
            {mgrs && <div className="text-t3 text-2xs font-mono">GRID: {mgrs}</div>}
            <div className="text-t3 text-2xs font-mono">SOURCE: {feat.src.toUpperCase()}</div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
              {feat.actor1 && (
                <div>
                  <div className="mvn-label mb-0.5">ACTEUR 1</div>
                  <div className="text-t2 text-2xs font-mono">{feat.actor1}</div>
                </div>
              )}
              {feat.actor2 && (
                <div>
                  <div className="mvn-label mb-0.5">CONTRE</div>
                  <div className="text-t2 text-2xs font-mono">{feat.actor2}</div>
                </div>
              )}
              {feat.platform && (
                <div>
                  <div className="mvn-label mb-0.5">PLATEFORME</div>
                  <div className="text-cyn text-2xs font-mono">{feat.platform}</div>
                </div>
              )}
              {feat.status && (
                <div>
                  <div className="mvn-label mb-0.5">STATUT</div>
                  <div className="text-t2 text-2xs font-mono">{feat.status}</div>
                </div>
              )}
              <div>
                <div className="mvn-label mb-0.5">DATE</div>
                <div className="text-t2 text-2xs font-mono">{feat.date || feat.time || '—'}</div>
              </div>
              <div>
                <div className="mvn-label mb-0.5">LIEU</div>
                <div className="text-t2 text-2xs font-mono truncate">{feat.location ?? feat.admin1 ?? '—'}</div>
              </div>
              {(feat.fatalities ?? 0) > 0 && (
                <div>
                  <div className="mvn-label mb-0.5">PERTES</div>
                  <div className="text-alert text-xs font-mono font-bold">▲ {feat.fatalities} KIA</div>
                </div>
              )}
              {feat.id && (
                <div>
                  <div className="mvn-label mb-0.5">TRACK ID</div>
                  <div className="text-t2 text-2xs font-mono">{feat.id}</div>
                </div>
              )}
            </div>

            {(feat.desc ?? feat.notes) && (
              <div className="mt-1 p-2 bg-b0 border border-b3">
                <p className="text-t2 text-2xs font-mono leading-relaxed">
                  {feat.desc ?? feat.notes}
                </p>
              </div>
            )}

            <button className="w-full py-1.5 border border-blu/40 text-blu text-2xs font-mono hover:bg-blu/10 hover:border-blu transition-colors">
              VOIR RAPPORT COMPLET
            </button>
          </div>
        </div>
      ) : (
        /* Default: situation overview */
        <div className="shrink-0 border-b border-b3">
          <div className="panel-header px-3 py-2 flex items-center gap-2">
            <div className="w-1 h-1 bg-blu shrink-0" />
            <span className="mvn-label">SITUATION — AOR RDC</span>
          </div>
          <div className="grid grid-cols-3 border-b border-b3">
            {[
              { label: 'EVENTS',  val: acledEvents.length, color: 'text-alert' },
              { label: 'STRIKES', val: strikes,             color: 'text-mag'   },
              { label: 'KIA',     val: totalKIA,            color: 'text-alert' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex flex-col items-center py-2 gap-0.5 border-r border-b3 last:border-r-0">
                <span className={`font-mono font-bold text-base ${color}`}>{val}</span>
                <span className="mvn-label">{label}</span>
              </div>
            ))}
          </div>
          {/* Intelligence view: show briefing sections */}
          {activeView === 'intelligence' && (
            <div className="divide-y divide-b3 max-h-[28vh] overflow-y-auto">
              {SECTIONS.slice(0, 3).map(({ key, label, color, dot, text }) => (
                <div key={key} className="px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-1 h-1 shrink-0 ${dot}`} />
                    <span className={`mvn-label ${color}`}>{label}</span>
                  </div>
                  <p className="text-t2 text-2xs font-mono leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* THREAT OVERVIEW — PAST 7D */}
      <div className="border-b border-b3 shrink-0">
        <div className="panel-header px-3 py-1.5 flex items-center justify-between">
          <span className="mvn-label">THREAT OVERVIEW — 7J</span>
          <div className="flex items-center gap-1.5">
            <span className="text-alert font-mono font-bold text-sm">{acledEvents.length}</span>
            <span className="text-grn text-2xs font-mono">TOTAL</span>
          </div>
        </div>
        <div className="px-3 pt-1 pb-2">
          <SparkLine data={sparkData} max={maxSpark} />
          <div className="flex justify-between text-t3 text-2xs font-mono mt-0.5">
            <span>J-7</span><span>J-5</span><span>J-3</span><span>J-1</span><span>AUJ</span>
          </div>
        </div>
      </div>

      {/* THREAT BREAKDOWN */}
      <div className="border-b border-b3 shrink-0">
        <div className="panel-header px-3 py-1.5">
          <span className="mvn-label">THREAT BREAKDOWN</span>
        </div>
        <div className="px-3 py-2 space-y-2">
          {breakdown.length === 0 ? (
            <div className="text-t3 text-2xs font-mono">AUCUN ÉVÉNEMENT</div>
          ) : (
            breakdown.map(({ type, pct }) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-2xs font-mono ${TYPE_COLOR[type] ?? 'text-t2'}`}>
                    {type}
                  </span>
                  <span className="text-t1 text-2xs font-mono font-bold">{pct}%</span>
                </div>
                <div className="w-full h-1 bg-b3">
                  <div className={`h-1 ${TYPE_BAR[type] ?? 'bg-t3'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ENTITY NETWORK */}
      <div className="flex-1 min-h-0">
        <div className="panel-header px-3 py-1.5 flex items-center justify-between">
          <span className="mvn-label">ENTITY NETWORK</span>
          <span className="text-t3 text-2xs font-mono">LINK ANALYSIS</span>
        </div>
        <div className="px-3 py-2">
          <EntityNetwork />
        </div>
      </div>

    </div>
  );
}

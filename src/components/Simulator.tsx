'use client';

import { useState } from 'react';
import type { SimulationOutput, ShockType, Sector, Region } from '@/lib/policy-engine';

// ── Label maps ────────────────────────────────────────────────────────────────

const SHOCK_OPTIONS: { value: ShockType; label: string }[] = [
  { value: 'trade_war',       label: 'Trade War' },
  { value: 'pandemic',        label: 'Pandemic' },
  { value: 'conflict',        label: 'Armed Conflict' },
  { value: 'climate',         label: 'Climate Shock' },
  { value: 'cyber_attack',    label: 'Cyber Attack' },
  { value: 'currency_crisis', label: 'Currency Crisis' },
  { value: 'energy_shock',    label: 'Energy Shock' },
];

const SECTOR_OPTIONS: { value: Sector; label: string }[] = [
  { value: 'energy',         label: 'Energy' },
  { value: 'finance',        label: 'Finance' },
  { value: 'agriculture',    label: 'Agriculture' },
  { value: 'manufacturing',  label: 'Manufacturing' },
  { value: 'technology',     label: 'Technology' },
  { value: 'healthcare',     label: 'Healthcare' },
  { value: 'transport',      label: 'Transport' },
  { value: 'trade',          label: 'Trade' },
];

const REGION_OPTIONS: { value: Region; label: string }[] = [
  { value: 'north_america', label: 'North America' },
  { value: 'europe',        label: 'Europe' },
  { value: 'asia_pacific',  label: 'Asia-Pacific' },
  { value: 'middle_east',   label: 'Middle East' },
  { value: 'africa',        label: 'Africa' },
  { value: 'latin_america', label: 'Latin America' },
  { value: 'south_asia',    label: 'South Asia' },
];

const RISK_COLOR: Record<string, string> = {
  low:      '#22c55e',
  moderate: '#f59e0b',
  high:     '#ef4444',
  critical: '#9333ea',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const label: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.3rem',
  color: '#94a3b8', fontSize: '0.8125rem',
};

const select: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
  color: '#e2e8f0', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', width: '100%',
};

const sectionTitle: React.CSSProperties = {
  color: '#94a3b8', fontSize: '0.6875rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function Simulator() {
  const [shockType,       setShockType]       = useState<ShockType>('trade_war');
  const [originSector,    setOriginSector]    = useState<Sector>('trade');
  const [affectedRegions, setAffectedRegions] = useState<Region[]>(['north_america', 'europe']);
  const [intensity,       setIntensity]       = useState(60);
  const [horizon,         setHorizon]         = useState(24);
  const [result,          setResult]          = useState<SimulationOutput | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  const toggleRegion = (r: Region) =>
    setAffectedRegions(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (affectedRegions.length === 0) { setError('Select at least one region.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shockType, originSector, affectedRegions, intensity, horizon }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Simulation failed');
      setResult(data as SimulationOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

      {/* ── Form panel ── */}
      <form onSubmit={handleSubmit} style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        <label style={label}>
          Shock type
          <select value={shockType} onChange={e => setShockType(e.target.value as ShockType)} style={select}>
            {SHOCK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <label style={label}>
          Origin sector
          <select value={originSector} onChange={e => setOriginSector(e.target.value as Sector)} style={select}>
            {SECTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <fieldset style={{ border: '1px solid #1e293b', borderRadius: 6, padding: '0.7rem' }}>
          <legend style={{ ...sectionTitle, padding: '0 0.25rem' }}>Affected regions</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
            {REGION_OPTIONS.map(r => (
              <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', color: '#cbd5e1' }}>
                <input type="checkbox" checked={affectedRegions.includes(r.value)} onChange={() => toggleRegion(r.value)} />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label style={label}>
          Intensity — <strong style={{ color: '#e2e8f0' }}>{intensity}%</strong>
          <input type="range" min={0} max={100} value={intensity} onChange={e => setIntensity(+e.target.value)} style={{ width: '100%' }} />
        </label>

        <label style={label}>
          Horizon — <strong style={{ color: '#e2e8f0' }}>{horizon} months</strong>
          <input type="range" min={1} max={60} value={horizon} onChange={e => setHorizon(+e.target.value)} style={{ width: '100%' }} />
        </label>

        {error && <p style={{ color: '#f87171', fontSize: '0.8125rem' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
            padding: '0.6rem 1rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {loading ? 'Simulating…' : 'Run simulation'}
        </button>
      </form>

      {/* ── Results panel ── */}
      {result && (
        <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Headline */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: RISK_COLOR[result.riskLevel], lineHeight: 1 }}>
                {result.disruptionScore}
              </div>
              <div style={{ color: '#475569', fontSize: '0.65rem', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>/ 100</div>
            </div>
            <div>
              <span style={{
                background: RISK_COLOR[result.riskLevel], color: '#fff',
                borderRadius: 999, padding: '0.2rem 0.65rem',
                fontSize: '0.75rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {result.riskLevel}
              </span>
              <p style={{ color: '#94a3b8', fontSize: '0.8125rem', marginTop: '0.5rem', lineHeight: 1.55 }}>
                {result.summary}
              </p>
            </div>
          </div>

          {/* Sector impact bars */}
          <div>
            <p style={sectionTitle}>Sector impact</p>
            {[...result.sectorImpacts].sort((a, b) => b.total - a.total).map(s => (
              <div key={s.sector} style={{ marginBottom: '0.55rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
                  <span style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{s.sector}</span>
                  <span style={{ color: '#64748b' }}>{s.total}</span>
                </div>
                <div style={{ height: 7, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${s.total}%`,
                    background: s.firstOrder > 0 ? '#f59e0b' : '#3b82f6',
                    borderRadius: 4,
                    transition: 'width 0.35s ease',
                  }} />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.7rem', color: '#475569' }}>
              <span><span style={{ color: '#f59e0b' }}>■</span> First-order (origin)</span>
              <span><span style={{ color: '#3b82f6' }}>■</span> Second-order (spillover)</span>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p style={sectionTitle}>Disruption timeline</p>
            <TimelineChart points={result.timeline} color={RISK_COLOR[result.riskLevel]} />
          </div>

        </div>
      )}
    </div>
  );
}

// ── SVG timeline chart ────────────────────────────────────────────────────────

function TimelineChart({ points, color }: { points: { month: number; disruption: number }[]; color: string }) {
  if (points.length === 0) return null;

  const W = 520, H = 160;
  const PAD = { top: 10, right: 16, bottom: 28, left: 34 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const maxMonth = points[points.length - 1].month;

  const px = (m: number) => PAD.left + ((m - 1) / Math.max(1, maxMonth - 1)) * iW;
  const py = (d: number) => PAD.top + iH - (d / 100) * iH;

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.month).toFixed(1)},${py(p.disruption).toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${px(maxMonth).toFixed(1)},${py(0).toFixed(1)} L${px(1).toFixed(1)},${py(0).toFixed(1)} Z`;

  const yTicks = [0, 25, 50, 75, 100];
  const xStep  = maxMonth <= 12 ? 2 : maxMonth <= 24 ? 4 : maxMonth <= 36 ? 6 : 12;
  const xTicks: number[] = [];
  for (let m = 1; m <= maxMonth; m += xStep) xTicks.push(m);
  if (xTicks[xTicks.length - 1] !== maxMonth) xTicks.push(maxMonth);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* grid */}
      {yTicks.map(t => (
        <line key={t} x1={PAD.left} x2={W - PAD.right} y1={py(t)} y2={py(t)} stroke="#1e293b" strokeWidth={1} />
      ))}
      {/* y labels */}
      {yTicks.map(t => (
        <text key={t} x={PAD.left - 5} y={py(t) + 4} textAnchor="end" fontSize={9} fill="#475569">{t}</text>
      ))}
      {/* x labels */}
      {xTicks.map(t => (
        <text key={t} x={px(t)} y={H - 5} textAnchor="middle" fontSize={9} fill="#475569">m{t}</text>
      ))}
      {/* area */}
      <path d={areaD} fill={color} fillOpacity={0.08} />
      {/* line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* peak dot */}
      {(() => {
        const peak = [...points].sort((a, b) => b.disruption - a.disruption)[0];
        return (
          <circle cx={px(peak.month)} cy={py(peak.disruption)} r={3} fill={color} />
        );
      })()}
    </svg>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

type Level = 'analyst' | 'operator' | 'commander';

const LEVELS: {
  id: Level; label: string; clearance: string; desc: string;
  ring: string; dot: string; bg: string;
}[] = [
  {
    id: 'analyst',   label: 'Analyst',   clearance: 'CONFIDENTIAL',
    desc: 'Lecture seule. Flux ACLED, FIRMS, ISR drone.',
    ring: 'ring-grn/40 hover:ring-grn/70',   dot: 'bg-grn',   bg: 'bg-grn/[0.06]',
  },
  {
    id: 'operator',  label: 'Operator',  clearance: 'SECRET',
    desc: 'Accès complet. Couches, export CSV.',
    ring: 'ring-blu/40 hover:ring-blu/70',   dot: 'bg-blu',   bg: 'bg-blu/[0.06]',
  },
  {
    id: 'commander', label: 'Commander', clearance: 'TOP SECRET',
    desc: 'Toutes sources. Évaluation tactique.',
    ring: 'ring-alert/40 hover:ring-alert/70', dot: 'bg-alert', bg: 'bg-alert/[0.06]',
  },
];

export default function LoginPage() {
  const router       = useRouter();
  const login        = useAuthStore((s) => s.login);
  const session      = useAuthStore((s) => s.session);
  const attempts     = useAuthStore((s) => s.attempts);
  const lockoutUntil = useAuthStore((s) => s.lockoutUntil);
  const push         = useToastStore((s) => s.push);

  const [level,      setLevel]      = useState<Level>('operator');
  const [user,       setUser]       = useState('');
  const [pass,       setPass]       = useState('');
  const [firmKey,    setFirmKey]    = useState('');
  const [acledKey,   setAcledKey]   = useState('');
  const [acledEmail, setAcledEmail] = useState('');
  const [countdown,  setCountdown]  = useState(0);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    if (session) router.replace('/monitor');
  }, [session, router]);

  useEffect(() => {
    if (lockoutUntil > Date.now()) {
      const tick = () => {
        const rem = Math.ceil((lockoutUntil - Date.now()) / 1000);
        setCountdown(Math.max(0, rem));
        if (rem > 0) setTimeout(tick, 1000);
        else setCountdown(0);
      };
      tick();
    }
  }, [lockoutUntil]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (countdown > 0) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 280));
    const result = login(user, pass, level, firmKey, acledKey, acledEmail);
    setLoading(false);
    if (result === 'ok') {
      push('Authentification réussie', 'success');
      router.replace('/monitor');
    } else if (result === 'locked') {
      push(`Compte verrouillé — réessayez dans ${countdown}s`, 'error');
    } else {
      push('Identifiants incorrects', 'error', 3000);
    }
  }, [user, pass, level, firmKey, acledKey, acledEmail, countdown, login, push, router]);

  const locked = countdown > 0;

  return (
    <div className="min-h-screen w-full bg-b0 flex flex-col items-center justify-center px-5">

      {/* App icon */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-[22px] bg-alert flex items-center justify-center shadow-float">
          <span className="text-white text-3xl font-bold tracking-tighter">S</span>
        </div>
        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold tracking-tight">Sentinelle-RDC</h1>
          <p className="text-t2 text-sm mt-1">C2 Intelligence Monitor · Kivu Est</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm glass rounded-3xl p-6 shadow-float">

        {/* Level selector */}
        <div className="mb-5">
          <p className="text-t3 text-xs font-semibold uppercase tracking-widest mb-3">
            Niveau d&apos;accès
          </p>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`
                  ring-1 rounded-2xl p-3 text-left transition-all duration-150
                  ${l.ring} ${level === l.id ? `${l.bg} ring-opacity-100` : 'bg-transparent ring-opacity-30'}
                `}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${l.dot} mb-2`} />
                <div className="text-white text-xs font-semibold">{l.label}</div>
                <div className="text-t3 text-2xs leading-tight mt-0.5">{l.clearance}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-white/[0.06] mb-5" />

        {/* Credentials */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-t3 text-xs font-medium uppercase tracking-wider mb-1.5 block">
              Identifiant
            </label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="analyst"
              required
              autoComplete="username"
              className="
                w-full bg-b3/60 border border-white/[0.08] rounded-xl
                px-4 py-3 text-white text-sm
                placeholder:text-t3
                focus:outline-none focus:border-blu/50 focus:bg-b3/80
                transition-all duration-150
              "
            />
          </div>
          <div>
            <label className="text-t3 text-xs font-medium uppercase tracking-wider mb-1.5 block">
              Mot de passe
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="
                w-full bg-b3/60 border border-white/[0.08] rounded-xl
                px-4 py-3 text-white text-sm
                placeholder:text-t3
                focus:outline-none focus:border-blu/50 focus:bg-b3/80
                transition-all duration-150
              "
            />
          </div>

          {/* API keys (collapsed) */}
          <details className="group">
            <summary className="text-t3 text-xs cursor-pointer hover:text-t2 transition-colors select-none py-1">
              ↳ Clés API (optionnel)
            </summary>
            <div className="mt-2.5 space-y-2 pl-2 border-l border-white/[0.06]">
              <input
                type="text"
                value={firmKey}
                onChange={(e) => setFirmKey(e.target.value)}
                placeholder="NASA FIRMS MAP_KEY"
                className="w-full bg-b3/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-t3 focus:outline-none focus:border-blu/50 transition-all"
              />
              <input
                type="text"
                value={acledKey}
                onChange={(e) => setAcledKey(e.target.value)}
                placeholder="ACLED API Key"
                className="w-full bg-b3/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-t3 focus:outline-none focus:border-blu/50 transition-all"
              />
              <input
                type="email"
                value={acledEmail}
                onChange={(e) => setAcledEmail(e.target.value)}
                placeholder="ACLED Email"
                className="w-full bg-b3/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-t3 focus:outline-none focus:border-blu/50 transition-all"
              />
            </div>
          </details>

          {/* Rate limit indicator */}
          {attempts > 0 && !locked && (
            <div className="text-amb text-xs font-mono">
              Tentative {attempts}/5 — {5 - attempts} restante{5 - attempts !== 1 ? 's' : ''}
            </div>
          )}
          {locked && (
            <div className="flex items-center gap-2 bg-alert/[0.08] border border-alert/20 rounded-xl px-4 py-3">
              <div className="w-1.5 h-1.5 rounded-full bg-alert animate-pulse-fast shrink-0" />
              <span className="text-alert text-xs font-medium">
                Verrouillé — réessayez dans {countdown}s
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={locked || loading}
            className="
              w-full rounded-2xl py-3.5 mt-1
              bg-blu hover:bg-[#0071eb] active:bg-[#006de0]
              disabled:bg-b3 disabled:text-t3
              text-white font-semibold text-sm
              transition-all duration-150 shadow-[0_4px_16px_rgba(10,132,255,0.3)]
              disabled:shadow-none
            "
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin-slow" />
                Authentification…
              </span>
            ) : locked ? (
              `Verrouillé (${countdown}s)`
            ) : (
              'Accès système'
            )}
          </button>
        </form>
      </div>

      {/* Demo hint */}
      <p className="mt-6 text-t3 text-xs text-center leading-relaxed">
        Démo · analyst/analyst2026 · operator/op3rator!
      </p>
    </div>
  );
}

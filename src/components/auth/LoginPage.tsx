'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

type Level = 'analyst' | 'operator' | 'commander';

const LEVELS: { id: Level; label: string; clearance: string; desc: string; color: string }[] = [
  { id: 'analyst',   label: 'ANALYST',   clearance: 'CONFIDENTIAL', desc: 'Read-only access. ACLED, FIRMS, drone ISR feeds.', color: 'border-grn/40 hover:border-grn' },
  { id: 'operator',  label: 'OPERATOR',  clearance: 'SECRET',       desc: 'Full feed access. Layer toggles. Export enabled.', color: 'border-blu/40 hover:border-blu' },
  { id: 'commander', label: 'COMMANDER', clearance: 'TOP SECRET',   desc: 'All feeds. Tactical overlay. Intel assessment.', color: 'border-alert/40 hover:border-alert' },
];

export default function LoginPage() {
  const router   = useRouter();
  const login    = useAuthStore((s) => s.login);
  const session  = useAuthStore((s) => s.session);
  const attempts = useAuthStore((s) => s.attempts);
  const lockoutUntil = useAuthStore((s) => s.lockoutUntil);
  const push     = useToastStore((s) => s.push);

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
    await new Promise((r) => setTimeout(r, 300));
    const result = login(user, pass, level, firmKey, acledKey, acledEmail);
    setLoading(false);
    if (result === 'ok') {
      push('Authentification réussie', 'success');
      router.replace('/monitor');
    } else if (result === 'locked') {
      push(`Compte verrouillé. Attendez ${countdown}s.`, 'error');
    } else {
      push('Identifiants incorrects.', 'error', 3000);
    }
  }, [user, pass, level, firmKey, acledKey, acledEmail, countdown, login, push, router]);

  const locked = countdown > 0;

  return (
    <div className="min-h-screen w-full bg-b0 flex flex-col items-center justify-center p-4 font-mono">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="text-2xs tracking-[0.3em] text-t3 uppercase mb-1">SYSTÈME SÉCURISÉ</div>
        <h1 className="text-t1 text-2xl font-bold tracking-widest uppercase">SENTINELLE-RDC</h1>
        <div className="text-t3 text-xs tracking-widest mt-1">C2 INTELLIGENCE MONITOR — KIVU EST</div>
        <div className="w-32 h-px bg-bd mx-auto mt-4" />
      </div>

      {/* Level selector */}
      <div className="w-full max-w-lg mb-6">
        <div className="text-t3 text-2xs tracking-widest uppercase mb-2">Niveau d&apos;accès</div>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLevel(l.id)}
              className={`
                border rounded p-3 text-left transition-all duration-150
                ${l.color}
                ${level === l.id ? 'bg-b3 border-opacity-100' : 'bg-b1 border-opacity-40'}
              `}
            >
              <div className="text-t1 text-xs font-bold mb-1">{l.label}</div>
              <div className="text-t3 text-2xs leading-tight">{l.clearance}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Login form */}
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-t3 text-2xs tracking-widest uppercase mb-1">Identifiant</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="analyst"
              required
              autoComplete="username"
              className="w-full bg-b1 border border-bd rounded px-3 py-2 text-t1 text-xs focus:outline-none focus:border-blu placeholder:text-t3"
            />
          </div>
          <div>
            <label className="block text-t3 text-2xs tracking-widest uppercase mb-1">Mot de passe</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full bg-b1 border border-bd rounded px-3 py-2 text-t1 text-xs focus:outline-none focus:border-blu placeholder:text-t3"
            />
          </div>
        </div>

        {/* Optional API keys */}
        <details className="group">
          <summary className="text-t3 text-2xs tracking-widest uppercase cursor-pointer hover:text-t2 select-none">
            Clés API (optionnel)
          </summary>
          <div className="mt-2 space-y-2 pl-2 border-l border-bd">
            <input
              type="text"
              value={firmKey}
              onChange={(e) => setFirmKey(e.target.value)}
              placeholder="NASA FIRMS MAP_KEY"
              className="w-full bg-b1 border border-bd rounded px-3 py-2 text-t1 text-xs focus:outline-none focus:border-blu placeholder:text-t3"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={acledKey}
                onChange={(e) => setAcledKey(e.target.value)}
                placeholder="ACLED API Key"
                className="w-full bg-b1 border border-bd rounded px-3 py-2 text-t1 text-xs focus:outline-none focus:border-blu placeholder:text-t3"
              />
              <input
                type="email"
                value={acledEmail}
                onChange={(e) => setAcledEmail(e.target.value)}
                placeholder="ACLED Email"
                className="w-full bg-b1 border border-bd rounded px-3 py-2 text-t1 text-xs focus:outline-none focus:border-blu placeholder:text-t3"
              />
            </div>
          </div>
        </details>

        {/* Rate limit warning */}
        {attempts > 0 && !locked && (
          <div className="text-amb text-2xs font-mono">
            Tentative {attempts}/5. Encore {5 - attempts} avant verrouillage.
          </div>
        )}
        {locked && (
          <div className="text-alert text-xs font-mono bg-alert/10 border border-alert/30 rounded px-3 py-2">
            Compte verrouillé. Réessayez dans {countdown}s.
          </div>
        )}

        <button
          type="submit"
          disabled={locked || loading}
          className="w-full bg-blu/90 hover:bg-blu disabled:bg-b3 disabled:text-t3 text-white rounded py-2.5 text-xs font-bold tracking-widest uppercase transition-colors"
        >
          {loading ? 'AUTHENTIFICATION…' : locked ? `VERROUILLÉ (${countdown}s)` : 'ACCÈS SYSTÈME'}
        </button>
      </form>

      {/* Demo hint */}
      <div className="mt-6 text-t3 text-2xs text-center leading-relaxed">
        Démo: analyst/analyst2026 · operator/op3rator! · commander/cmd@rdc2026
      </div>
    </div>
  );
}

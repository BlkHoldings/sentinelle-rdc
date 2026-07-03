'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

type Level = 'analyst' | 'operator' | 'commander';

const LEVELS: {
  id: Level; label: string; clearance: string; desc: string; dot: string;
}[] = [
  {
    id: 'analyst',   label: 'ANALYST',   clearance: 'CONFIDENTIAL',
    desc: 'RD-ONLY / ACLED FIRMS ISR',  dot: 'bg-grn',
  },
  {
    id: 'operator',  label: 'OPERATOR',  clearance: 'SECRET',
    desc: 'FULL ACCESS / CSV EXPORT',    dot: 'bg-blu',
  },
  {
    id: 'commander', label: 'COMMANDER', clearance: 'TOP SECRET',
    desc: 'ALL SOURCES / EVAL TACT',     dot: 'bg-alert',
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
      push('AUTHENTICATION SUCCESSFUL', 'success');
      router.replace('/monitor');
    } else if (result === 'locked') {
      push(`ACCOUNT LOCKED — RETRY IN ${countdown}s`, 'error');
    } else {
      push('INVALID CREDENTIALS', 'error', 3000);
    }
  }, [user, pass, level, firmKey, acledKey, acledEmail, countdown, login, push, router]);

  const locked = countdown > 0;

  return (
    <div className="min-h-screen w-full bg-b0 flex flex-col" style={{ fontFamily: 'ui-monospace, monospace' }}>

      {/* Classification banner */}
      <div className="classify h-6 flex items-center justify-center shrink-0">
        SECRET // REL TO USA, COD, UNMISS // SENTINELLE-RDC
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">

        {/* System designation */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-4 bg-alert" />
            <h1 className="text-t1 text-lg font-bold tracking-widest uppercase">
              SENTINELLE-RDC
            </h1>
            <div className="w-2 h-4 bg-alert" />
          </div>
          <p className="text-t3 text-xs font-mono tracking-widest uppercase">
            C2 INTELLIGENCE MONITOR // AOR EST-DRC
          </p>
          <p className="text-t3 text-2xs font-mono mt-1">
            AUTHORIZED USERS ONLY — UNAUTHORIZED ACCESS IS PROHIBITED
          </p>
        </div>

        {/* Auth panel */}
        <div className="w-full max-w-sm panel shadow-float">

          {/* Panel header */}
          <div className="panel-header px-3 py-2 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blu shrink-0" />
            <span className="mvn-label">AUTHENTICATION REQUIRED</span>
          </div>

          <div className="p-4 space-y-4">

            {/* Access level selector */}
            <div>
              <div className="mvn-label mb-2">ACCESS LEVEL</div>
              <div className="space-y-1">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLevel(l.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 border transition-colors text-left
                      ${level === l.id
                        ? 'border-blu bg-blu/10 text-t1'
                        : 'border-b3 text-t3 hover:border-t3 hover:bg-b1'}
                    `}
                  >
                    <div className={`w-1.5 h-1.5 shrink-0 ${l.dot}`} />
                    <div className="flex-1">
                      <div className="text-2xs font-mono font-bold">{l.label}</div>
                      <div className="text-2xs font-mono text-t3">{l.desc}</div>
                    </div>
                    <div className="text-2xs font-mono text-t3">{l.clearance}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-b3" />

            {/* Credentials */}
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <div className="mvn-label mb-1">IDENTIFIER</div>
                <input
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="analyst"
                  required
                  autoComplete="username"
                  className="
                    w-full bg-b0 border border-b3 focus:border-blu
                    px-3 py-2 text-t1 text-xs font-mono
                    placeholder:text-t3
                    focus:outline-none transition-colors
                  "
                />
              </div>

              <div>
                <div className="mvn-label mb-1">PASSPHRASE</div>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="
                    w-full bg-b0 border border-b3 focus:border-blu
                    px-3 py-2 text-t1 text-xs font-mono
                    placeholder:text-t3
                    focus:outline-none transition-colors
                  "
                />
              </div>

              {/* API keys */}
              <details className="group">
                <summary className="mvn-label cursor-pointer hover:text-t2 transition-colors py-1 select-none">
                  ▸ API CREDENTIALS (OPTIONAL)
                </summary>
                <div className="mt-2 space-y-1.5 pl-3 border-l border-b3">
                  <input
                    type="text"
                    value={firmKey}
                    onChange={(e) => setFirmKey(e.target.value)}
                    placeholder="NASA FIRMS MAP_KEY"
                    className="w-full bg-b0 border border-b3 focus:border-blu px-2 py-1.5 text-t1 text-2xs font-mono placeholder:text-t3 focus:outline-none transition-colors"
                  />
                  <input
                    type="text"
                    value={acledKey}
                    onChange={(e) => setAcledKey(e.target.value)}
                    placeholder="ACLED API KEY"
                    className="w-full bg-b0 border border-b3 focus:border-blu px-2 py-1.5 text-t1 text-2xs font-mono placeholder:text-t3 focus:outline-none transition-colors"
                  />
                  <input
                    type="email"
                    value={acledEmail}
                    onChange={(e) => setAcledEmail(e.target.value)}
                    placeholder="ACLED EMAIL"
                    className="w-full bg-b0 border border-b3 focus:border-blu px-2 py-1.5 text-t1 text-2xs font-mono placeholder:text-t3 focus:outline-none transition-colors"
                  />
                </div>
              </details>

              {/* Attempt warning */}
              {attempts > 0 && !locked && (
                <div className="text-amb text-2xs font-mono border border-amb/30 px-2 py-1">
                  ATTEMPT {attempts}/5 — {5 - attempts} REMAINING
                </div>
              )}
              {locked && (
                <div className="flex items-center gap-2 border border-alert/40 bg-alert/[0.06] px-2 py-2">
                  <div className="w-1.5 h-1.5 bg-alert animate-pulse-fast shrink-0" />
                  <span className="text-alert text-2xs font-mono">
                    ACCOUNT LOCKED — RETRY IN {countdown}s
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={locked || loading}
                className="
                  w-full py-2.5 mt-1
                  bg-blu hover:bg-[#1a66d8] active:bg-[#1660c8]
                  disabled:bg-b3 disabled:text-t3 disabled:cursor-not-allowed
                  text-white font-mono font-bold text-xs tracking-widest uppercase
                  border border-blu/0 hover:border-blu/20
                  transition-colors duration-150
                "
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin-slow" />
                    AUTHENTICATING…
                  </span>
                ) : locked ? (
                  `LOCKED (${countdown}s)`
                ) : (
                  'AUTHENTICATE'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 panel px-3 py-2 text-center">
          <p className="text-t3 text-2xs font-mono">
            DEMO: analyst/analyst2026 · operator/op3rator!
          </p>
        </div>
      </div>

      {/* Bottom classify */}
      <div className="classify h-6 flex items-center justify-center shrink-0">
        SECRET // REL TO USA, COD, UNMISS // SENTINELLE-RDC
      </div>
    </div>
  );
}

'use client';

/* Sign-in. Authentication is unchanged: demonstration accounts checked
   in the browser, five attempts, thirty-second lockout. The page says
   plainly that this is a demonstration gate and not access control.

   The former "access level" picker is gone. The role has always come
   from the account, and the picker's value was discarded by `login` —
   a control that appears to grant a clearance and does nothing is worse
   than no control. */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { LANGS } from '@/lib/i18n';
import { BrandMark } from '@/components/layout/NavRail';

const TXT = {
  fr: {
    tagline: 'Intelligence stratégique — RDC et Grands Lacs',
    title: 'Connexion',
    user: 'Identifiant', pass: 'Mot de passe', submit: 'Se connecter', wait: 'Vérification…',
    locked: (s: number) => `Trop de tentatives. Réessayez dans ${s} s.`,
    bad: (n: number) => `Identifiant ou mot de passe incorrect. ${n} tentative(s) restante(s).`,
    keys: 'Clés d’API (facultatif)', keysNote: 'Sans clé, les jeux de données embarqués sont utilisés. Les clés restent dans ce navigateur.',
    demo: 'Comptes de démonstration',
    demoNote: 'Contrôle effectué dans le navigateur : il organise la démonstration, il ne protège rien.',
    roles: { analyst: 'analyste', operator: 'relecteur', commander: 'responsable' },
    stripe: 'Environnement de démonstration — données illustratives, non vérifiées',
    lang: 'Langue',
  },
  en: {
    tagline: 'Strategic intelligence — DRC and Great Lakes',
    title: 'Sign in',
    user: 'Username', pass: 'Password', submit: 'Sign in', wait: 'Checking…',
    locked: (s: number) => `Too many attempts. Try again in ${s} s.`,
    bad: (n: number) => `Incorrect username or password. ${n} attempt(s) left.`,
    keys: 'API keys (optional)', keysNote: 'Without keys, the bundled datasets are used. Keys stay in this browser.',
    demo: 'Demonstration accounts',
    demoNote: 'Checked in the browser: it organises the demonstration, it protects nothing.',
    roles: { analyst: 'analyst', operator: 'reviewer', commander: 'lead' },
    stripe: 'Demonstration environment — illustrative data, not verified',
    lang: 'Language',
  },
};

const DEMO: { user: string; pass: string; role: 'analyst' | 'operator' | 'commander' }[] = [
  { user: 'analyst',   pass: 'analyst2026', role: 'analyst' },
  { user: 'operator',  pass: 'op3rator!',   role: 'operator' },
  { user: 'commander', pass: 'cmd@rdc2026', role: 'commander' },
];

const field =
  'w-full h-9 bg-b0 border border-b3 hover:border-t3 focus:border-blu rounded px-2.5 text-sm text-t1 placeholder:text-t3 focus:outline-none transition-colors';

export default function LoginPage() {
  const router       = useRouter();
  const login        = useAuthStore((s) => s.login);
  const session      = useAuthStore((s) => s.session);
  const attempts     = useAuthStore((s) => s.attempts);
  const lockoutUntil = useAuthStore((s) => s.lockoutUntil);
  const lang         = useSettingsStore((s) => s.lang);
  const setLang      = useSettingsStore((s) => s.setLang);
  const tx = TXT[lang];

  const [user,       setUser]       = useState('');
  const [pass,       setPass]       = useState('');
  const [firmKey,    setFirmKey]    = useState('');
  const [acledKey,   setAcledKey]   = useState('');
  const [acledEmail, setAcledEmail] = useState('');
  const [countdown,  setCountdown]  = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [failed,     setFailed]     = useState(false);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  useEffect(() => {
    if (session) router.replace('/monitor');
  }, [session, router]);

  useEffect(() => {
    if (lockoutUntil <= Date.now()) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setCountdown(rem);
      if (rem > 0) timer = setTimeout(tick, 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [lockoutUntil]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (countdown > 0) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 200));
    const result = login(user, pass, 'operator', firmKey, acledKey, acledEmail);
    setLoading(false);
    if (result === 'ok') router.replace('/monitor');
    else setFailed(true);
  }, [user, pass, firmKey, acledKey, acledEmail, countdown, login, router]);

  const locked = countdown > 0;
  const error = locked ? tx.locked(countdown) : failed ? tx.bad(Math.max(0, 5 - attempts)) : '';

  return (
    <div className="min-h-screen min-h-dvh w-full bg-b0 flex flex-col overflow-y-auto">
      <div className="classify h-5 flex items-center justify-center shrink-0 truncate px-2" role="note">
        NKOYI — {tx.stripe}
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <BrandMark size={36} />
            <div>
              <div className="text-t1 text-xl font-semibold tracking-[0.2em] leading-none">NKOYI</div>
              <div className="text-t3 text-xs mt-1.5">{tx.tagline}</div>
            </div>
            <div className="ml-auto flex" role="group" aria-label={tx.lang}>
              {LANGS.map((l) => (
                <button key={l.code} type="button" onClick={() => setLang(l.code)} aria-pressed={lang === l.code} lang={l.code}
                  className={`px-1.5 py-1 text-2xs font-semibold uppercase ${lang === l.code ? 'text-t1' : 'text-t3 hover:text-t2'}`}>
                  {l.code}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-b1 border border-b3 rounded p-5 space-y-4" noValidate>
            <h1 className="text-t1 text-base font-semibold">{tx.title}</h1>

            <label className="block">
              <span className="block text-xs text-t2 mb-1">{tx.user}</span>
              <input type="text" value={user} onChange={(e) => { setUser(e.target.value); setFailed(false); }}
                autoComplete="username" autoCapitalize="none" spellCheck={false} required
                className={field} data-testid="login-user" />
            </label>

            <label className="block">
              <span className="block text-xs text-t2 mb-1">{tx.pass}</span>
              <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setFailed(false); }}
                autoComplete="current-password" required className={field} data-testid="login-pass"
                aria-describedby={error ? 'login-error' : undefined} aria-invalid={failed || undefined} />
            </label>

            {error && (
              <p id="login-error" role="alert" className="text-xs text-alert leading-snug" data-testid="login-error">{error}</p>
            )}

            <details className="group">
              <summary className="text-xs text-t3 hover:text-t1 cursor-pointer select-none">{tx.keys}</summary>
              <div className="mt-2 space-y-2">
                <p className="text-2xs text-t3 leading-snug">{tx.keysNote}</p>
                <input type="text" value={firmKey} onChange={(e) => setFirmKey(e.target.value)} placeholder="NASA FIRMS MAP_KEY"
                  aria-label="NASA FIRMS MAP_KEY" className={field} autoComplete="off" />
                <input type="text" value={acledKey} onChange={(e) => setAcledKey(e.target.value)} placeholder="ACLED API key"
                  aria-label="ACLED API key" className={field} autoComplete="off" />
                <input type="email" value={acledEmail} onChange={(e) => setAcledEmail(e.target.value)} placeholder="ACLED e-mail"
                  aria-label="ACLED e-mail" className={field} autoComplete="off" />
              </div>
            </details>

            <button type="submit" disabled={locked || loading || !user || !pass} data-testid="login-submit"
              className="w-full h-9 rounded bg-t1 text-b0 text-sm font-semibold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {loading ? tx.wait : tx.submit}
            </button>
          </form>

          <section className="mt-4 border border-b3 rounded px-4 py-3" aria-label={tx.demo}>
            <h2 className="text-3xs font-semibold uppercase tracking-[0.09em] text-t3 mb-1.5">{tx.demo}</h2>
            <ul className="space-y-1">
              {DEMO.map((d) => (
                <li key={d.user} className="flex items-center gap-2 text-2xs">
                  <button type="button" onClick={() => { setUser(d.user); setPass(d.pass); setFailed(false); }}
                    className="font-data text-t1 hover:text-blu underline underline-offset-2 decoration-b3 hover:decoration-blu">
                    {d.user} / {d.pass}
                  </button>
                  <span className="text-t3 ml-auto">{tx.roles[d.role]}</span>
                </li>
              ))}
            </ul>
            <p className="text-3xs text-t3 mt-2 leading-snug">{tx.demoNote}</p>
          </section>
        </div>
      </main>
    </div>
  );
}

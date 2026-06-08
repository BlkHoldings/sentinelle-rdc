'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserSession } from '@/types/intel';
import { randomHex } from '@/lib/utils';

const DEMO_CREDS: Record<string, { pass: string; clearance: string; level: 'analyst' | 'operator' | 'commander' }> = {
  analyst:    { pass: 'analyst2026',  clearance: 'CONFIDENTIAL', level: 'analyst' },
  operator:   { pass: 'op3rator!',    clearance: 'SECRET',       level: 'operator' },
  commander:  { pass: 'cmd@rdc2026', clearance: 'TOP SECRET',    level: 'commander' },
};

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS   = 5;
const LOCKOUT_SEC    = 30;

interface AuthState {
  session:      UserSession | null;
  attempts:     number;
  lockoutUntil: number;
  firmKey:      string;
  acledKey:     string;
  acledEmail:   string;
  login: (user: string, pass: string, level: string, firmKey: string, acledKey: string, acledEmail: string) => 'ok' | 'bad_creds' | 'locked';
  logout:       () => void;
  isExpired:    () => boolean;
  setApiKeys:   (firmKey: string, acledKey: string, acledEmail: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session:      null,
      attempts:     0,
      lockoutUntil: 0,
      firmKey:      '',
      acledKey:     '',
      acledEmail:   '',

      login(user, pass, _level, firmKey, acledKey, acledEmail) {
        const now = Date.now();
        const { attempts, lockoutUntil } = get();
        if (now < lockoutUntil) return 'locked';

        const entry = DEMO_CREDS[user.toLowerCase()];
        if (!entry || entry.pass !== pass) {
          const next = attempts + 1;
          if (next >= MAX_ATTEMPTS) {
            set({ attempts: 0, lockoutUntil: now + LOCKOUT_SEC * 1000 });
          } else {
            set({ attempts: next });
          }
          return 'bad_creds';
        }

        const session: UserSession = {
          token:     randomHex(16),
          user:      user.toLowerCase(),
          clearance: entry.clearance,
          level:     entry.level,
          loginTime: new Date().toISOString(),
        };
        set({ session, attempts: 0, lockoutUntil: 0, firmKey, acledKey, acledEmail });
        return 'ok';
      },

      logout() {
        set({ session: null });
      },

      isExpired() {
        const { session } = get();
        if (!session) return true;
        return Date.now() - new Date(session.loginTime).getTime() > SESSION_TTL_MS;
      },

      setApiKeys(firmKey, acledKey, acledEmail) {
        set({ firmKey, acledKey, acledEmail });
      },
    }),
    {
      name:    'sentinelle-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        session:    s.session,
        firmKey:    s.firmKey,
        acledKey:   s.acledKey,
        acledEmail: s.acledEmail,
      }),
    },
  ),
);

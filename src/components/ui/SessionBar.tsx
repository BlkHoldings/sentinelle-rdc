'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export default function SessionBar() {
  const session   = useAuthStore((s) => s.session);
  const logout    = useAuthStore((s) => s.logout);
  const router    = useRouter();
  const [remaining, setRemaining] = useState('');
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    if (!session) return;
    const loginTime = new Date(session.loginTime).getTime();

    const tick = () => {
      const elapsed = Date.now() - loginTime;
      const rem     = SESSION_TTL_MS - elapsed;
      if (rem <= 0) {
        logout();
        router.replace('/');
        return;
      }
      const hours   = Math.floor(rem / 3_600_000);
      const minutes = Math.floor((rem % 3_600_000) / 60_000);
      setRemaining(`${hours}h${minutes.toString().padStart(2, '0')}`);
      setWarn(rem < 30 * 60 * 1000);
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [session, logout, router]);

  if (!session) return null;

  return (
    <div className={`
      absolute bottom-0 left-0 right-0 h-7 z-session
      flex items-center justify-between px-3
      bg-b1/90 backdrop-blur-sm border-t border-bd
      font-mono text-2xs
    `}>
      <div className="flex items-center gap-3 text-t3">
        <span>SESSION ACTIVE</span>
        <span className="text-t2 uppercase">{session.clearance}</span>
        <span>{session.user.toUpperCase()}</span>
      </div>
      <div className={warn ? 'text-alert animate-pulse-slow' : 'text-t3'}>
        Expiration: {remaining}
      </div>
    </div>
  );
}

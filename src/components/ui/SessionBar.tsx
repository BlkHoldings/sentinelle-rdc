'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const WARN_MS        = 30 * 60 * 1000;

export default function SessionBar() {
  const session  = useAuthStore((s) => s.session);
  const logout   = useAuthStore((s) => s.logout);
  const router   = useRouter();
  const [remaining, setRemaining] = useState('');
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    if (!session) return;
    const loginTime = new Date(session.loginTime).getTime();
    const tick = () => {
      const elapsed = Date.now() - loginTime;
      const rem     = SESSION_TTL_MS - elapsed;
      if (rem <= 0) { logout(); router.replace('/'); return; }
      const h = Math.floor(rem / 3_600_000);
      const m = Math.floor((rem % 3_600_000) / 60_000);
      setRemaining(`${h}h${m.toString().padStart(2, '0')}`);
      setWarn(rem < WARN_MS);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [session, logout, router]);

  if (!session) return null;

  return (
    <div className="
      absolute bottom-0 left-0 right-0 h-8 z-session
      flex items-center justify-between px-3
      bg-b2 border-t border-b3
    ">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 bg-grn" />
          <span className="mvn-label text-grn">SESSION ACTIVE</span>
        </div>
        <span className="text-b3 text-2xs font-mono">|</span>
        <span className="mvn-label">{session.clearance}</span>
        <span className="text-b3 text-2xs font-mono">|</span>
        <span className="text-t3 text-2xs font-mono uppercase">{session.user}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="mvn-label">AOR: EST-DRC</span>
        <span className="text-b3 text-2xs font-mono">|</span>
        <span className={`text-2xs font-mono ${warn ? 'text-alert animate-pulse-slow' : 'text-t3'}`}>
          TTL:{remaining}
        </span>
      </div>
    </div>
  );
}

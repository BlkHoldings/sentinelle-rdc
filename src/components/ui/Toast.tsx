'use client';

import { useEffect, useState } from 'react';
import { useToastStore, type Toast as ToastItem } from '@/store/useToastStore';

const ICON: Record<ToastItem['type'], string> = {
  info:    '●',
  success: '✓',
  warn:    '⚠',
  error:   '✕',
};

const COLOR: Record<ToastItem['type'], string> = {
  info:    'text-drone border-drone/20',
  success: 'text-grn   border-grn/20',
  warn:    'text-amb   border-amb/20',
  error:   'text-alert border-alert/20',
};

function Toast({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`
        flex items-center gap-3 pl-3.5 pr-3 py-3
        glass rounded-2xl border
        transition-all duration-200 min-w-[240px] max-w-xs
        shadow-panel
        ${COLOR[toast.type]}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      <span className="text-xs font-bold shrink-0">{ICON[toast.type]}</span>
      <span className="flex-1 text-white text-sm leading-snug">{toast.msg}</span>
      <button
        onClick={() => remove(toast.id)}
        className="shrink-0 text-t3 hover:text-white text-sm transition-colors ml-1"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-toast flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-slide-up">
          <Toast toast={t} />
        </div>
      ))}
    </div>
  );
}

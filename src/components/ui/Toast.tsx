'use client';

import { useEffect, useState } from 'react';
import { useToastStore, type Toast as ToastItem } from '@/store/useToastStore';

const TYPE_STYLES: Record<ToastItem['type'], string> = {
  info:    'border-blu/40   bg-blu/10   text-blu',
  success: 'border-grn/40   bg-grn/10   text-grn',
  warn:    'border-amb/40   bg-amb/10   text-amb',
  error:   'border-alert/40 bg-alert/10 text-alert',
};

function ToastItem({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(show);
  }, []);

  return (
    <div
      className={`
        flex items-start gap-2 px-3 py-2 rounded border
        font-mono text-xs max-w-xs shadow-xl
        transition-all duration-200
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${TYPE_STYLES[toast.type]}
      `}
    >
      <span className="flex-1 leading-relaxed">{toast.msg}</span>
      <button
        onClick={() => remove(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 mt-0.5"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-toast flex flex-col gap-1.5 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}

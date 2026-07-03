'use client';

import { useEffect } from 'react';
import { useToastStore, type Toast, type ToastType } from '@/store/useToastStore';

const LEVEL_STYLE: Record<ToastType, { bar: string; label: string }> = {
  success: { bar: 'bg-grn',   label: 'text-grn'   },
  error:   { bar: 'bg-alert', label: 'text-alert'  },
  warn:    { bar: 'bg-amb',   label: 'text-amb'    },
  info:    { bar: 'bg-blu',   label: 'text-blu'    },
};

const LEVEL_LABEL: Record<ToastType, string> = {
  success: 'CONFIRM',
  error:   'ALERT',
  warn:    'WARNING',
  info:    'INFO',
};

export default function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-toast flex flex-col gap-1 pointer-events-none items-center">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { bar, label } = LEVEL_STYLE[toast.type];

  useEffect(() => {
    const id = setTimeout(onDismiss, toast.duration ?? 4000);
    return () => clearTimeout(id);
  }, [toast.duration, onDismiss]);

  return (
    <div
      className="pointer-events-auto panel animate-slide-up shadow-panel flex items-stretch overflow-hidden"
      style={{ minWidth: '260px' }}
    >
      <div className={`w-1 shrink-0 ${bar}`} />
      <div className="flex items-center gap-3 px-3 py-2 flex-1">
        <span className={`mvn-label shrink-0 ${label}`}>{LEVEL_LABEL[toast.type]}</span>
        <span className="text-t1 text-2xs font-mono">{toast.msg}</span>
      </div>
      <button
        onClick={onDismiss}
        className="px-2 text-t3 hover:text-t1 text-xs font-mono transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

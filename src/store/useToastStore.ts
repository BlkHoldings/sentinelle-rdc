'use client';

import { create } from 'zustand';
import { randomHex } from '@/lib/utils';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id:       string;
  msg:      string;
  type:     ToastType;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push:   (msg: string, type?: ToastType, duration?: number) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push(msg, type = 'info', duration = 4000) {
    const id = randomHex(4);
    set((s) => ({ toasts: [...s.toasts, { id, msg, type, duration }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration);
  },

  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

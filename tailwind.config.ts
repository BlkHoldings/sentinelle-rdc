import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      /* ── Maven tactical color palette ─────────────────────────── */
      colors: {
        b0: '#0b0d10',   // deep background
        b1: '#101318',   // panel surface
        b2: '#161a21',   // panel header / stripe
        b3: '#242a34',   // border / grid line
        bd: '#2c3440',   // hover surface
        t1: '#e6e9ee',   // primary text
        t2: '#9aa3b0',   // secondary text
        t3: '#7f8896',   // muted / label
        alert: { DEFAULT: '#e5484d', muted: 'rgba(229,72,77,0.14)' },
        amb:   { DEFAULT: '#e2a336', muted: 'rgba(226,163,54,0.14)' },
        grn:   { DEFAULT: '#3fb984', muted: 'rgba(63,185,132,0.14)' },
        blu:   { DEFAULT: '#6f9bff', muted: 'rgba(111,155,255,0.14)' },
        cyn:   { DEFAULT: '#58c4dc', muted: 'rgba(88,196,220,0.14)' },
        pur:   { DEFAULT: '#9d8cff', muted: 'rgba(157,140,255,0.14)' },
        fire:  { DEFAULT: '#f0803c', muted: 'rgba(240,128,60,0.14)' },
        mag:   { DEFAULT: '#d6577a', muted: 'rgba(214,87,122,0.14)' },
        drone: { DEFAULT: '#6fd3e6', muted: 'rgba(111,211,230,0.14)' },
      },
      /* ── Maven typography: monospace-first ──────────────────── */
      /* Sans for interface text; mono only where characters must align
         (coordinates, timestamps, counts, identifiers). */
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'ui-monospace', 'Consolas', 'monospace'],
        data: ['var(--font-mono)', 'IBM Plex Mono', 'ui-monospace', 'Consolas', 'monospace'],
      },
      /* rem-based, so the text-size setting scales everything together.
         Nothing in the interface renders below 10 px at the default size. */
      fontSize: {
        '3xs': ['0.625rem',  { lineHeight: '1.3' }],
        '2xs': ['0.6875rem', { lineHeight: '1.35' }],
        xs:    ['0.75rem',   { lineHeight: '1.4' }],
        sm:    ['0.8125rem', { lineHeight: '1.45' }],
      },
      /* ── Square corners: override all rounded-* ─────────────── */
      borderRadius: {
        DEFAULT: '3px',
        none:    '0px',
        sm:      '1px',
        md:      '3px',
        lg:      '4px',
        xl:      '3px',
        '2xl':   '3px',
        '3xl':   '3px',
        full:    '9999px', // keep for circular map dots only
      },
      zIndex: {
        globe:   '0',
        overlay: '10',
        panel:   '20',
        hud:     '30',
        header:  '40',
        session: '50',
        toast:   '60',
        modal:   '70',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.2' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        blastRing: {
          '0%':   { transform: 'translate(-50%,-50%) scale(0.5)', opacity: '0.5' },
          '100%': { transform: 'translate(-50%,-50%) scale(2)', opacity: '0' },
        },
        scanline: {
          '0%':   { top: '0%', opacity: '0.6' },
          '100%': { top: '100%', opacity: '0' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'pulse-slow':  'pulse 2s ease-in-out infinite',
        'pulse-fast':  'pulse 0.7s ease-in-out infinite',
        'slide-up':    'slideUp 0.15s ease-out',
        'fade-in':     'fadeIn 0.2s ease-out',
        'blast-ring':  'blastRing 2.5s ease-out infinite',
        'spin-slow':   'spin 0.65s linear infinite',
        'scanline':    'scanline 3s linear infinite',
      },
      boxShadow: {
        panel: '0 4px 20px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)',
        float: '0 8px 32px rgba(0,0,0,0.95)',
        'glow-alert': '0 0 6px rgba(229,72,77,0.5)',
        'glow-blu':   '0 0 6px rgba(111,155,255,0.5)',
        'glow-cyn':   '0 0 6px rgba(88,196,220,0.5)',
        'glow-grn':   '0 0 6px rgba(63,185,132,0.5)',
      },
    },
  },
  plugins: [],
};

export default config;

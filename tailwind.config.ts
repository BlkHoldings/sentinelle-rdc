import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      /* ── Maven tactical color palette ─────────────────────────── */
      colors: {
        b0: '#090d13',   // deep background
        b1: '#0d1520',   // panel surface
        b2: '#121e2e',   // panel header / stripe
        b3: '#1a2e42',   // border / grid line
        bd: '#1f3a52',   // hover surface
        t1: '#c8d8e8',   // primary text
        t2: '#7890a8',   // secondary text
        t3: '#445870',   // muted / label
        alert: { DEFAULT: '#e03030', muted: 'rgba(224,48,48,0.14)' },
        amb:   { DEFAULT: '#d09820', muted: 'rgba(208,152,32,0.14)' },
        grn:   { DEFAULT: '#20c880', muted: 'rgba(32,200,128,0.14)' },
        blu:   { DEFAULT: '#1e70f0', muted: 'rgba(30,112,240,0.14)' },
        cyn:   { DEFAULT: '#18c8e0', muted: 'rgba(24,200,224,0.14)' },
        pur:   { DEFAULT: '#8060d8', muted: 'rgba(128,96,216,0.14)' },
        fire:  { DEFAULT: '#e06020', muted: 'rgba(224,96,32,0.14)' },
        mag:   { DEFAULT: '#c83048', muted: 'rgba(200,48,72,0.14)' },
        drone: { DEFAULT: '#18d8f0', muted: 'rgba(24,216,240,0.14)' },
      },
      /* ── Maven typography: monospace-first ──────────────────── */
      fontFamily: {
        sans: ['ui-monospace', 'IBM Plex Mono', 'Consolas', 'monospace'],
        mono: ['ui-monospace', 'IBM Plex Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem',  { lineHeight: '1.2' }],
        '3xs': ['0.5625rem', { lineHeight: '1' }],
      },
      /* ── Square corners: override all rounded-* ─────────────── */
      borderRadius: {
        DEFAULT: '2px',
        none:    '0px',
        sm:      '1px',
        md:      '2px',
        lg:      '2px',
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
        'glow-alert': '0 0 6px rgba(224,48,48,0.5)',
        'glow-blu':   '0 0 6px rgba(30,112,240,0.5)',
        'glow-cyn':   '0 0 6px rgba(24,200,224,0.5)',
        'glow-grn':   '0 0 6px rgba(32,200,128,0.5)',
      },
    },
  },
  plugins: [],
};

export default config;

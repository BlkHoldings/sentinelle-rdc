'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DemoRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push('/dashboard'), 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #16a34a22 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: 'white',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <div style={{
        width: 56,
        height: 56,
        background: 'linear-gradient(135deg, #3730a3, #22c55e)',
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.75rem',
        fontWeight: 900,
        marginBottom: '1.5rem',
        boxShadow: '0 8px 32px rgba(55,48,163,0.4)',
      }}>
        C
      </div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Commerce Opus DRC
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Chargement du tableau de bord démo…
      </p>

      <div style={{
        width: 200,
        height: 4,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #4f46e5, #22c55e)',
          borderRadius: 2,
          animation: 'progress 1.2s ease-in-out forwards',
        }} />
      </div>

      <style>{`
        @keyframes progress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>

      <p style={{ marginTop: '2rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
        Aucune inscription requise — accès immédiat
      </p>
    </div>
  );
}

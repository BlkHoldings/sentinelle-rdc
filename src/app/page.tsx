import Simulator from '@/components/Simulator';

export default function Home() {
  return (
    <main style={{ maxWidth: 1140, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <header style={{ marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
          DISP-Lite
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.2rem', fontSize: '0.8125rem' }}>
          Geopolitical Disruption Policy Simulator
        </p>
      </header>
      <Simulator />
    </main>
  );
}

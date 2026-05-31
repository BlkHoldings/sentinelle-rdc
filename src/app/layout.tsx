import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DISP-Lite — Disruption Policy Simulator',
  description: 'Geopolitical disruption policy simulation MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

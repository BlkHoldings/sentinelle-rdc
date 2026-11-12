import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import './globals.css';

const ibmPlexMono = IBM_Plex_Mono({
  weight:   ['400', '500', '600'],
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
});

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-sans',
  display:  'swap',
});

export const metadata: Metadata = {
  title:       'NKOYI | Intelligence stratégique',
  description: 'NKOYI — espace d’analyse stratégique fondé sur les preuves : RDC et Grands Lacs',
  robots:      { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${ibmPlexMono.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}

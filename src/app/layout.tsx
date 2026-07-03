import type { Metadata } from 'next';
import { IBM_Plex_Mono, Outfit } from 'next/font/google';
import './globals.css';

const ibmPlexMono = IBM_Plex_Mono({
  weight:   ['400', '500', '600'],
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
});

const outfit = Outfit({
  subsets:  ['latin'],
  variable: '--font-sans',
  display:  'swap',
});

export const metadata: Metadata = {
  title:       'SENTINELLE-RDC | C2 Intelligence Monitor',
  description: 'Command & Control intelligence dashboard — Eastern DRC conflict monitoring',
  robots:      { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${ibmPlexMono.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}

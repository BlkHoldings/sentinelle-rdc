import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Commerce Opus DRC — Créez votre boutique, vendez sur WhatsApp & Instagram',
  description:
    'Plateforme e-commerce pour les commerçants congolais. Créez votre boutique en 3 clics et acceptez M-Pesa, Orange Money, Airtel Money.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Providers } from '@/components/ui/Providers';

export const metadata: Metadata = {
  title: 'PredictFi — Decentralized Prediction Markets on Stellar',
  description:
    'Trade outcome shares, build your forecasting reputation, and earn on prediction markets powered by Stellar and Soroban.',
  keywords: ['prediction market', 'stellar', 'soroban', 'defi', 'forecasting'],
  openGraph: {
    title: 'PredictFi',
    description: 'Decentralized Prediction Markets on Stellar',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Trophy, Wallet, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WalletButton } from '@/components/wallet/WalletButton';

const NAV_LINKS = [
  { href: '/markets', label: 'Markets', icon: BarChart3 },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/portfolio', label: 'Portfolio', icon: TrendingUp },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-background font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-lg tracking-tight">
              Predict<span className="text-primary">Fi</span>
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:text-white hover:bg-accent',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/create"
              prefetch
              className="hidden sm:flex items-center gap-2 btn-primary text-sm py-2"
            >
              <Plus className="w-4 h-4" />
              Create Market
            </Link>
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}

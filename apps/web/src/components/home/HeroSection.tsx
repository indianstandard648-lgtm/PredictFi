'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Shield, TrendingUp } from 'lucide-react';

const FEATURES = [
  { icon: Zap, label: 'Instant settlement on Stellar' },
  { icon: Shield, label: 'Non-custodial USDC trading' },
  { icon: TrendingUp, label: 'Build forecasting reputation' },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 pb-32">
      {/* Background glow */}
      <div className="absolute inset-0 bg-hero-gradient pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-primary text-sm font-medium mb-8"
        >
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          Built on Stellar Testnet
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
        >
          Predict the Future.
          <br />
          <span className="text-primary">Earn the Truth.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg text-muted max-w-2xl mx-auto mb-10"
        >
          Trade YES/NO shares on real-world events. Markets resolve automatically.
          The best forecasters earn a reputation that lasts forever on-chain.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/markets" className="btn-primary flex items-center gap-2 text-base px-8 py-3.5">
            Explore Markets
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/create" className="btn-outline text-base px-8 py-3.5">
            Create a Market
          </Link>
        </motion.div>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 bg-card border border-border rounded-full px-5 py-2.5"
            >
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

'use client';

import { motion } from 'framer-motion';
import { Search, ArrowRightLeft, Trophy } from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    step: '01',
    title: 'Pick a Market',
    description:
      'Browse markets across crypto, sports, politics, and more. Each market is a yes/no question about a real-world event.',
  },
  {
    icon: ArrowRightLeft,
    step: '02',
    title: 'Trade YES or NO',
    description:
      'Buy shares at the current probability price. Lower probability = more shares per dollar. Prices move as traders buy and sell.',
  },
  {
    icon: Trophy,
    step: '03',
    title: 'Claim Your Winnings',
    description:
      'When the market resolves, winners claim their USDC automatically. Your on-chain Forecast Reputation Score grows with every correct prediction.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl font-bold mb-3">How It Works</h2>
          <p className="text-muted max-w-xl mx-auto">
            Three steps to start earning on your predictions.
          </p>
        </motion.div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-px bg-border" />

          {STEPS.map(({ icon: Icon, step, title, description }, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="flex flex-col items-center text-center"
            >
              {/* Icon circle */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 text-xs font-bold text-primary bg-background border border-primary/30 rounded-full w-6 h-6 flex items-center justify-center">
                  {i + 1}
                </span>
              </div>

              <h3 className="text-lg font-bold mb-2">{title}</h3>
              <p className="text-muted text-sm leading-relaxed max-w-xs">{description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

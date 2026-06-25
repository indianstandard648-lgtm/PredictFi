'use client';

import { motion } from 'framer-motion';
import { Zap, Lock, Globe, BarChart2, Award, RefreshCw } from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Sub-second Settlement',
    description:
      'Stellar processes 1,000+ transactions per second at $0.00001 per tx. Your trade confirms before you blink.',
  },
  {
    icon: Lock,
    title: 'Non-custodial',
    description:
      'Your USDC never leaves your control. Smart contracts on Soroban hold funds, not a company.',
  },
  {
    icon: Globe,
    title: 'Permissionless Markets',
    description:
      'Anyone can create a market on any topic. No approval process, no gatekeepers.',
  },
  {
    icon: BarChart2,
    title: 'Real Price Discovery',
    description:
      'Market prices are set by real traders, not algorithms. The crowd wisdom shows in every probability.',
  },
  {
    icon: Award,
    title: 'On-chain Reputation',
    description:
      'Your Forecast Reputation Score (FRS) is permanently on-chain. Prove your edge to the world.',
  },
  {
    icon: RefreshCw,
    title: 'Automated Resolution',
    description:
      'Oracle-driven resolution means no waiting for manual payouts. Winners claim instantly after resolution.',
  },
];

export function WhyPredictFi() {
  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl font-bold mb-3">Why PredictFi?</h2>
          <p className="text-muted max-w-xl mx-auto">
            Built for serious forecasters who want a protocol that puts them in control.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="card-base p-6 flex flex-col gap-4 hover:border-primary/20 transition-colors duration-200"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

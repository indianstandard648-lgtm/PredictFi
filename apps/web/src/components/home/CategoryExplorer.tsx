'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bitcoin, Dumbbell, Landmark, Cloud, Bot, DollarSign, Layers } from 'lucide-react';

const CATEGORIES = [
  { icon: Bitcoin,  label: 'Crypto',    color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', query: 'CRYPTO' },
  { icon: Dumbbell, label: 'Sports',    color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20',   query: 'SPORTS' },
  { icon: Landmark, label: 'Politics',  color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20',    query: 'POLITICS' },
  { icon: Cloud,    label: 'Weather',   color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/20',   query: 'WEATHER' },
  { icon: Bot,      label: 'AI',        color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', query: 'AI' },
  { icon: DollarSign, label: 'Finance', color: 'text-primary',    bg: 'bg-primary/10',    border: 'border-primary/20',    query: 'FINANCE' },
  { icon: Layers,   label: 'Custom',    color: 'text-muted',      bg: 'bg-accent',        border: 'border-border',        query: 'CUSTOM' },
];

export function CategoryExplorer() {
  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-3">Browse by Category</h2>
          <p className="text-muted">Find markets across every topic that matters to you.</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {CATEGORIES.map(({ icon: Icon, label, color, bg, border, query }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                href={`/markets?category=${query}`}
                className={`flex flex-col items-center gap-3 p-5 rounded-xl border ${bg} ${border} hover:scale-105 transition-all duration-200 group`}
              >
                <div className={`w-12 h-12 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <span className={`text-sm font-semibold ${color}`}>{label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

export function CTABanner() {
  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden border border-primary/20 bg-primary/5 px-8 py-16 text-center"
        >
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Start building your forecasting edge
            </div>

            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Ready to put your
              <br />
              <span className="text-primary">predictions on-chain?</span>
            </h2>

            <p className="text-muted max-w-lg mx-auto mb-10 text-lg">
              Join the growing community of forecasters earning USDC and building
              permanent reputation on Stellar.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/markets"
                className="btn-primary flex items-center gap-2 text-base px-8 py-3.5"
              >
                Start Trading
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/create"
                className="btn-outline text-base px-8 py-3.5"
              >
                Create a Market
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

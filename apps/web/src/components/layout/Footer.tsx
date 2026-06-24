import Link from 'next/link';
import { Github, Twitter, ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-background font-bold text-sm">P</span>
              </div>
              <span className="font-bold text-lg">
                Predict<span className="text-primary">Fi</span>
              </span>
            </div>
            <p className="text-muted text-sm max-w-xs">
              Decentralized prediction markets on Stellar. Trade outcome shares,
              build your forecasting reputation, and earn.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <a href="#" className="text-muted hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Platform</h4>
            <ul className="space-y-2">
              {[
                ['Markets', '/markets'],
                ['Create Market', '/create'],
                ['Leaderboard', '/leaderboard'],
                ['Portfolio', '/portfolio'],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-muted text-sm hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Resources</h4>
            <ul className="space-y-2">
              {[
                ['Stellar', 'https://stellar.org'],
                ['Soroban Docs', 'https://developers.stellar.org/docs/smart-contracts'],
                ['Freighter Wallet', 'https://www.freighter.app'],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-muted text-sm hover:text-white transition-colors"
                  >
                    {label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted text-xs">
            © 2025 PredictFi. Built on Stellar Testnet. Not financial advice.
          </p>
          <p className="text-muted text-xs font-mono">
            Powered by Soroban Smart Contracts
          </p>
        </div>
      </div>
    </footer>
  );
}

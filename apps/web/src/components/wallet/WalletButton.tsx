'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ChevronDown, Copy, LogOut, User, ExternalLink } from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';
import { connectWallet, disconnectWallet, stellarExplorerUrl } from '@/lib/stellar';
import { formatAddress } from '@/lib/utils';
import { authUser } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

export function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect, setConnecting } = useWalletStore();
  const [open, setOpen] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      connect(addr, 'freighter');
      await authUser(addr);
      toast.success('Wallet connected');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await disconnectWallet();
    disconnect();
    setOpen(false);
    toast.success('Wallet disconnected');
  }

  function copyAddress() {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied');
    }
  }

  if (!isConnected || !address) {
    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="flex items-center gap-2 border border-primary/30 text-primary hover:bg-primary hover:text-background px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
      >
        <Wallet className="w-4 h-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-accent border border-border px-4 py-2 rounded-lg text-sm font-medium hover:border-primary/30 transition-all duration-200"
      >
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary text-xs font-bold">
            {address.slice(0, 2)}
          </span>
        </div>
        <span className="font-mono">{formatAddress(address)}</span>
        <ChevronDown className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted mb-1">Connected wallet</p>
              <p className="font-mono text-sm">{formatAddress(address, 6)}</p>
            </div>

            <div className="p-1">
              <Link
                href={`/profile/${address}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm transition-colors"
              >
                <User className="w-4 h-4 text-muted" />
                Profile
              </Link>
              <button
                onClick={copyAddress}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm transition-colors"
              >
                <Copy className="w-4 h-4 text-muted" />
                Copy Address
              </button>
              <a
                href={stellarExplorerUrl('account', address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-muted" />
                View on Explorer
              </a>
            </div>

            <div className="p-1 border-t border-border">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-no/10 text-no text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Info, Loader2, Lock } from 'lucide-react';
import { Market } from '@/types';
import { useWalletStore } from '@/stores/walletStore';
import { useMarketStore } from '@/stores/marketStore';
import {
  buildLockMarketTx,
  extractContractError,
  readPoolsFromChain,
  ChainPools,
} from '@/lib/contracts';
import { lockMarket } from '@/lib/api';
import {
  buildBuyYesTx, buildBuyNoTx,
  signTransaction, submitSignedTransaction, waitForTransaction, usdcToStroop,
} from '@/lib/stellar';
import { buyPosition } from '@/lib/api';
import { calculateShares, formatUSDC, clampProbability } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Props {
  market: Market;
}

export function TradingPanel({ market }: Props) {
  const { address, isConnected } = useWalletStore();
  const { updateMarketProbability } = useMarketStore();
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [chainPools, setChainPools] = useState<ChainPools | null>(null);

  const isExpired = new Date(market.endDate) <= new Date();
  const isOpen = market.status === 'OPEN';
  const canLock = isOpen && isExpired;
  const canTrade = isOpen && !isExpired && !!market.onchainId;

  // Fetch live pool data from chain when wallet is connected
  useEffect(() => {
    if (!address || !market.onchainId) return;
    let cancelled = false;

    const fetchPools = async () => {
      try {
        const pools = await readPoolsFromChain(market.onchainId!, address);
        if (!cancelled) setChainPools(pools);
      } catch {
        // Fall back to API data silently
      }
    };

    fetchPools();
    const interval = setInterval(fetchPools, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [address, market.onchainId]);

  const yesPool = chainPools ? chainPools.yesPool : parseFloat(market.yesPool);
  const noPool = chainPools ? chainPools.noPool : parseFloat(market.noPool);
  const probYes = chainPools ? chainPools.probYes : market.probabilityYes;
  const probNo = chainPools ? chainPools.probNo : market.probabilityNo;

  const usdcAmount = parseFloat(amount) || 0;
  const { shares, newProbability } = calculateShares(yesPool, noPool, side, usdcAmount);
  const currentProb = side === 'YES' ? probYes : probNo;
  const priceImpact = Math.abs(newProbability - currentProb);

  async function handleTrade() {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet');
      return;
    }
    if (usdcAmount < 1) {
      toast.error('Minimum trade is 1 USDC');
      return;
    }
    if (!canTrade) {
      toast.error('Market is not open for trading');
      return;
    }

    setIsTrading(true);
    const loadingToast = toast.loading('Preparing transaction...');

    try {
      const stroops = usdcToStroop(usdcAmount);

      // Single transaction: buy_yes/buy_no — USDC transfer auth is included automatically
      toast.loading(`Preparing ${side} position...`, { id: loadingToast });
      const buyTxXdr = side === 'YES'
        ? await buildBuyYesTx(address, market.onchainId!, stroops)
        : await buildBuyNoTx(address, market.onchainId!, stroops);

      toast.loading('Waiting for wallet signature...', { id: loadingToast });
      const signedBuy = await signTransaction(buyTxXdr, address);

      toast.loading('Submitting to Stellar network...', { id: loadingToast });
      const buyTxHash = await submitSignedTransaction(signedBuy);

      toast.loading('Waiting for ledger confirmation...', { id: loadingToast });
      await waitForTransaction(buyTxHash);

      // Sync position with backend
      await buyPosition(address, {
        marketId: market.id,
        side,
        amountUsdc: usdcAmount,
        txHash: buyTxHash,
      });

      // Refresh chain pools
      if (address && market.onchainId) {
        const updated = await readPoolsFromChain(market.onchainId, address).catch(() => null);
        if (updated) {
          setChainPools(updated);
          updateMarketProbability(market.id, updated.yesPool, updated.noPool);
        }
      }

      toast.success(
        `Bought ${shares.toFixed(2)} ${side} shares! Tx: ${buyTxHash.slice(0, 8)}...`,
        { id: loadingToast, duration: 5000 },
      );
      setAmount('');
    } catch (e: any) {
      const msg = extractContractError(e?.message ?? 'Trade failed');
      toast.error(msg, { id: loadingToast });
    } finally {
      setIsTrading(false);
    }
  }

  async function handleLockMarket() {
    if (!address) return;
    setIsLocking(true);
    const loadingToast = toast.loading('Locking market...');
    try {
      const lockTxXdr = await buildLockMarketTx(address, market.onchainId!);
      const signedXdr = await signTransaction(lockTxXdr, address);
      const lockTxHash = await submitSignedTransaction(signedXdr);
      await waitForTransaction(lockTxHash);

      await lockMarket(address, market.id).catch(() => {}); // best-effort API sync

      toast.success('Market locked — trading closed', { id: loadingToast });
    } catch (e: any) {
      const msg = extractContractError(e?.message ?? 'Lock failed');
      toast.error(msg, { id: loadingToast });
    } finally {
      setIsLocking(false);
    }
  }

  const PRESETS = [5, 10, 25, 50, 100];

  // ── Expired / Locked view ─────────────────────────────────────────────────
  if (!isOpen || isExpired) {
    return (
      <div className="card-base p-5 space-y-4">
        <div className="flex items-center gap-2 text-muted">
          <Lock className="w-4 h-4" />
          <h3 className="font-semibold text-sm uppercase tracking-wider">
            {market.status === 'LOCKED' ? 'Trading Closed' :
             market.status === 'RESOLVED' ? 'Market Resolved' :
             isExpired ? 'Trading Ended' : 'Market Paused'}
          </h3>
        </div>

        <div className="text-center py-4">
          <p className="text-muted text-sm mb-1">
            {market.status === 'RESOLVED'
              ? 'This market has been resolved.'
              : 'Trading period has ended.'}
          </p>
          <p className="text-xs text-muted">
            {market.status !== 'RESOLVED' && 'Waiting for oracle resolution.'}
          </p>
        </div>

        {canLock && isConnected && (
          <button
            onClick={handleLockMarket}
            disabled={isLocking || !market.onchainId}
            className="w-full py-3 rounded-lg border border-warning/30 text-warning text-sm font-medium flex items-center justify-center gap-2 hover:bg-warning/10 disabled:opacity-40 transition-colors"
          >
            {isLocking ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Locking...</>
            ) : (
              <><Lock className="w-4 h-4" /> Lock Market On-Chain</>
            )}
          </button>
        )}

        {/* Pool summary for resolved markets */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-primary/5 rounded-lg text-center">
            <p className="text-xs text-muted mb-1">YES Pool</p>
            <p className="font-mono font-bold text-primary">{formatUSDC(yesPool)}</p>
          </div>
          <div className="p-3 bg-no/5 rounded-lg text-center">
            <p className="text-xs text-muted mb-1">NO Pool</p>
            <p className="font-mono font-bold text-no">{formatUSDC(noPool)}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Trading view ─────────────────────────────────────────────────────────
  return (
    <div className="card-base p-5 space-y-4">
      <h3 className="font-semibold text-sm text-muted uppercase tracking-wider">Trade</h3>

      {/* YES / NO Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSide('YES')}
          className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
            side === 'YES'
              ? 'bg-primary text-background'
              : 'bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20'
          }`}
        >
          YES {probYes.toFixed(1)}%
        </button>
        <button
          onClick={() => setSide('NO')}
          className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
            side === 'NO'
              ? 'bg-no text-white'
              : 'bg-no/10 border border-no/20 text-no hover:bg-no/20'
          }`}
        >
          NO {probNo.toFixed(1)}%
        </button>
      </div>

      {/* Amount Input */}
      <div>
        <label className="text-xs text-muted mb-1.5 block">Amount (USDC)</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="1"
            className="input-base pr-16 font-mono"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm">
            USDC
          </span>
        </div>
        <div className="flex gap-1.5 mt-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              className="flex-1 py-1.5 text-xs rounded bg-accent hover:bg-accent/80 text-muted hover:text-white transition-colors"
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {/* Order Summary */}
      <AnimatePresence>
        {usdcAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 text-sm border-t border-border pt-3"
          >
            <div className="flex justify-between">
              <span className="text-muted">Est. Shares</span>
              <span className="font-mono font-medium">{shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Avg Price</span>
              <span className="font-mono font-medium">
                {shares > 0 ? formatUSDC(usdcAmount / shares) : '$0.00'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">New Probability</span>
              <span className={`font-mono font-medium ${side === 'YES' ? 'text-primary' : 'text-no'}`}>
                {clampProbability(newProbability).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Max Payout</span>
              <span className="font-mono font-medium text-primary">
                {formatUSDC(shares * (1 - 0.02))}
              </span>
            </div>
            {priceImpact > 3 && (
              <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg text-warning text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                High price impact: {priceImpact.toFixed(1)}%. Consider smaller trades.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={isTrading || !isConnected || usdcAmount < 1 || !canTrade}
        className={`w-full py-3.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
          side === 'YES'
            ? 'bg-primary text-background hover:bg-primary-400'
            : 'bg-no text-white hover:bg-red-500'
        }`}
      >
        {isTrading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : !isConnected ? (
          'Connect Wallet to Trade'
        ) : !market.onchainId ? (
          'Market Not On-Chain'
        ) : (
          `Buy ${side} — ${formatUSDC(usdcAmount)}`
        )}
      </button>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        2% platform fee deducted from winnings
        {chainPools && (
          <span className="ml-auto text-primary/60">● live</span>
        )}
      </div>
    </div>
  );
}

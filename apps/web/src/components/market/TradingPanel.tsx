'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Info, Loader2 } from 'lucide-react';
import { Market } from '@/types';
import { useWalletStore } from '@/stores/walletStore';
import { useMarketStore } from '@/stores/marketStore';
import {
  buildBuyYesTx, buildBuyNoTx, buildApproveUsdcTx,
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

  const yesPool = parseFloat(market.yesPool);
  const noPool = parseFloat(market.noPool);
  const usdcAmount = parseFloat(amount) || 0;

  const { shares, newProbability } = calculateShares(yesPool, noPool, side, usdcAmount);

  const currentProb = side === 'YES' ? market.probabilityYes : market.probabilityNo;
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
    if (market.status !== 'OPEN') {
      toast.error('Market is not open for trading');
      return;
    }
    if (!market.onchainId) {
      toast.error('Market not yet deployed on-chain');
      return;
    }

    setIsTrading(true);
    const loadingToast = toast.loading('Preparing transaction...');

    try {
      const stroops = usdcToStroop(usdcAmount);

      // Step 1: Approve USDC spending
      toast.loading('Approving USDC...', { id: loadingToast });
      const approveTxXdr = await buildApproveUsdcTx(address, stroops);
      const signedApprove = await signTransaction(approveTxXdr, address);
      const approveTxHash = await submitSignedTransaction(signedApprove);
      await waitForTransaction(approveTxHash);

      // Step 2: Buy position
      toast.loading(`Buying ${side} shares...`, { id: loadingToast });
      const buyTxXdr = side === 'YES'
        ? await buildBuyYesTx(address, market.onchainId, stroops)
        : await buildBuyNoTx(address, market.onchainId, stroops);

      const signedBuy = await signTransaction(buyTxXdr, address);
      const buyTxHash = await submitSignedTransaction(signedBuy);
      await waitForTransaction(buyTxHash);

      // Step 3: Record in backend
      await buyPosition(address, {
        marketId: market.id,
        side,
        amountUsdc: usdcAmount,
        txHash: buyTxHash,
      });

      // Update market probabilities in store
      const newYesPool = side === 'YES' ? yesPool + usdcAmount : yesPool;
      const newNoPool = side === 'NO' ? noPool + usdcAmount : noPool;
      updateMarketProbability(market.id, newYesPool, newNoPool);

      toast.success(`Bought ${shares.toFixed(2)} ${side} shares!`, { id: loadingToast });
      setAmount('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Trade failed', { id: loadingToast });
    } finally {
      setIsTrading(false);
    }
  }

  const PRESETS = [5, 10, 25, 50, 100];

  return (
    <div className="card-base p-5 space-y-4">
      <h3 className="font-semibold text-sm text-muted uppercase tracking-wider">
        Trade
      </h3>

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
          YES {market.probabilityYes.toFixed(1)}%
        </button>
        <button
          onClick={() => setSide('NO')}
          className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
            side === 'NO'
              ? 'bg-no text-white'
              : 'bg-no/10 border border-no/20 text-no hover:bg-no/20'
          }`}
        >
          NO {market.probabilityNo.toFixed(1)}%
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
        {/* Presets */}
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
                {formatUSDC(usdcAmount / shares)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">New Probability</span>
              <span className={`font-mono font-medium ${side === 'YES' ? 'text-primary' : 'text-no'}`}>
                {clampProbability(newProbability).toFixed(1)}%
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
        disabled={isTrading || !isConnected || usdcAmount < 1 || market.status !== 'OPEN'}
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
        ) : (
          `Buy ${side} — ${formatUSDC(usdcAmount)}`
        )}
      </button>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        2% platform fee deducted from winnings
      </div>
    </div>
  );
}

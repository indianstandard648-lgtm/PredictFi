'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, FileText, Tag, Globe, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { createMarket } from '@/lib/api';
import { useWalletStore } from '@/stores/walletStore';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'CRYPTO', 'POLITICS', 'SPORTS', 'FINANCE',
  'TECH', 'SCIENCE', 'ENTERTAINMENT', 'WORLD_EVENTS', 'OTHER',
];

const ORACLE_SOURCES = [
  { value: 'admin', label: 'Admin Resolution (MVP)' },
  { value: 'uma', label: 'UMA Protocol (Coming Soon)', disabled: true },
  { value: 'chainlink', label: 'Chainlink Oracle (Coming Soon)', disabled: true },
  { value: 'reality_eth', label: 'Reality.eth (Coming Soon)', disabled: true },
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { address, isConnected } = useWalletStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'CRYPTO',
    endDate: '',
    resolutionDate: '',
    oracleSource: 'admin',
    tags: '',
    imageUrl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (form.title.length < 10) errs.title = 'Title must be at least 10 characters';
    if (form.description.length < 20) errs.description = 'Description must be at least 20 characters';
    if (!form.endDate) errs.endDate = 'End date is required';
    if (!form.resolutionDate) errs.resolutionDate = 'Resolution date is required';
    if (form.endDate && new Date(form.endDate) <= new Date()) {
      errs.endDate = 'End date must be in the future';
    }
    if (form.endDate && form.resolutionDate && form.resolutionDate < form.endDate) {
      errs.resolutionDate = 'Resolution date must be after end date';
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      const market = await createMarket(address, {
        title: form.title,
        description: form.description,
        category: form.category,
        endDate: new Date(form.endDate).toISOString(),
        resolutionDate: new Date(form.resolutionDate).toISOString(),
        oracleSource: form.oracleSource,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        imageUrl: form.imageUrl || undefined,
      });

      setSubmitted(true);
      toast.success('Market created successfully!');
      setTimeout(() => router.push(`/markets/${market.id}`), 1500);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create market');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle className="w-10 h-10 text-primary" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2">Market Created!</h2>
        <p className="text-muted">Redirecting to your market...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Prediction Market</h1>
        <p className="text-muted">
          Ask a question about the future. Anyone can trade YES or NO shares.
        </p>
      </div>

      {!isConnected && (
        <div className="flex items-center gap-3 p-4 bg-warning/10 border border-warning/20 rounded-xl mb-6">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
          <p className="text-sm text-warning">Connect your wallet to create markets</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Market Question */}
        <div className="card-base p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Market Details
          </h3>

          <div>
            <label className="text-sm text-muted block mb-1.5">
              Market Question <span className="text-no">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="Will Bitcoin reach $100,000 by December 2025?"
              maxLength={200}
              className={`input-base ${errors.title ? 'border-no/50' : ''}`}
            />
            <div className="flex justify-between mt-1">
              {errors.title ? (
                <p className="text-xs text-no">{errors.title}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted">{form.title.length}/200</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">
              Description <span className="text-no">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Provide context, resolution criteria, and data sources for this market."
              rows={4}
              maxLength={2000}
              className={`input-base resize-none ${errors.description ? 'border-no/50' : ''}`}
            />
            {errors.description && (
              <p className="text-xs text-no mt-1">{errors.description}</p>
            )}
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => update('category', cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    form.category === cat
                      ? 'bg-primary text-background'
                      : 'bg-accent text-muted hover:text-white'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="card-base p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Timeline
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted block mb-1.5">
                Trading Closes <span className="text-no">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className={`input-base ${errors.endDate ? 'border-no/50' : ''}`}
              />
              {errors.endDate && (
                <p className="text-xs text-no mt-1">{errors.endDate}</p>
              )}
            </div>

            <div>
              <label className="text-sm text-muted block mb-1.5">
                Resolution Date <span className="text-no">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.resolutionDate}
                onChange={(e) => update('resolutionDate', e.target.value)}
                min={form.endDate || new Date().toISOString().slice(0, 16)}
                className={`input-base ${errors.resolutionDate ? 'border-no/50' : ''}`}
              />
              {errors.resolutionDate && (
                <p className="text-xs text-no mt-1">{errors.resolutionDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Oracle */}
        <div className="card-base p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Resolution Oracle
          </h3>

          <div className="space-y-2">
            {ORACLE_SOURCES.map(({ value, label, disabled }) => (
              <label
                key={value}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  form.oracleSource === value && !disabled
                    ? 'border-primary/50 bg-primary/5'
                    : disabled
                    ? 'border-border opacity-40 cursor-not-allowed'
                    : 'border-border hover:border-primary/20'
                }`}
              >
                <input
                  type="radio"
                  name="oracleSource"
                  value={value}
                  checked={form.oracleSource === value}
                  onChange={() => !disabled && update('oracleSource', value)}
                  disabled={disabled}
                  className="accent-primary"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Optional Fields */}
        <div className="card-base p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Optional
          </h3>

          <div>
            <label className="text-sm text-muted block mb-1.5">Tags (comma separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
              placeholder="bitcoin, crypto, price"
              className="input-base"
            />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">Cover Image URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => update('imageUrl', e.target.value)}
              placeholder="https://..."
              className="input-base"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !isConnected}
          className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Market...
            </>
          ) : (
            'Create Market'
          )}
        </button>
      </form>
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchProfile, fetchReputation } from '@/lib/api';
import { formatAddress, formatUSDC, formatDate, cn } from '@/lib/utils';
import { Trophy, Target, TrendingUp, Flame, Calendar, BarChart2 } from 'lucide-react';

interface Props {
  params: { address: string };
}

export const revalidate = 60;

export default async function ProfilePage({ params }: Props) {
  const [profile, reputation] = await Promise.all([
    fetchProfile(params.address).catch(() => null),
    fetchReputation(params.address).catch(() => null),
  ]);

  if (!profile) return notFound();

  const rep = reputation;
  const accuracy = rep ? parseFloat(rep.accuracy) : 0;
  const winRate = rep ? parseFloat(rep.winRate) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Profile Header */}
      <div className="card-base p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
            {(profile.username ?? params.address).slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {profile.username ?? formatAddress(params.address, 6)}
            </h1>
            <p className="font-mono text-muted text-sm mt-1">{params.address}</p>
            {profile.bio && (
              <p className="text-sm text-muted mt-2 max-w-lg">{profile.bio}</p>
            )}
            <p className="text-xs text-muted mt-3">
              <Calendar className="w-3 h-3 inline mr-1" />
              Joined {formatDate(profile.createdAt)}
            </p>
          </div>

          {rep && (
            <div className="text-right">
              <p className="text-xs text-muted mb-1">FRS Score</p>
              <p className="text-4xl font-bold font-mono text-primary">
                {parseFloat(rep.reputationScore).toFixed(1)}
              </p>
              {rep.rank && (
                <p className="text-xs text-muted mt-1">Rank #{rep.rank}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reputation Stats */}
      {rep && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Predictions', value: rep.totalPredictions, icon: BarChart2 },
            { label: 'Correct', value: rep.correctPredictions, icon: Target },
            { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, icon: Trophy, color: 'text-primary' },
            { label: 'Accuracy', value: `${accuracy.toFixed(1)}%`, icon: Target, color: 'text-primary' },
            { label: 'Volume', value: formatUSDC(rep.totalVolume), icon: TrendingUp },
            { label: 'Streak', value: `${rep.streak}🔥`, icon: Flame, color: rep.streak > 0 ? 'text-warning' : '' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-muted" />
                <span className="text-xs text-muted">{label}</span>
              </div>
              <span className={cn('text-xl font-bold font-mono', color)}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Accuracy breakdown */}
      {rep && (
        <div className="card-base p-6 mb-6">
          <h2 className="font-semibold mb-4">Reputation Breakdown</h2>
          {[
            { label: 'Accuracy', value: accuracy, weight: '40%' },
            { label: 'Volume Score', value: Math.min(100, Math.log10(parseFloat(rep.totalVolume) + 1) * 20), weight: '20%' },
            {
              label: 'Profitability',
              value: Math.max(0, parseFloat(rep.totalVolume) > 0
                ? Math.min(100, (parseFloat(rep.totalProfit) / parseFloat(rep.totalVolume)) * 100)
                : 0),
              weight: '20%',
            },
            { label: 'Consistency', value: Math.min(100, rep.bestStreak * 10), weight: '20%' },
          ].map(({ label, value, weight }) => (
            <div key={label} className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{weight}</span>
                  <span className="font-mono font-medium text-primary">{value.toFixed(1)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full"
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Predictions */}
      <div className="card-base p-6">
        <h2 className="font-semibold mb-4">Recent Predictions</h2>
        {profile.positions && profile.positions.length > 0 ? (
          <div className="space-y-3">
            {profile.positions.slice(0, 10).map((position: any) => (
              <div key={position.id} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                <Link
                  href={`/markets/${position.marketId}`}
                  className="flex-1 hover:text-primary transition-colors text-sm line-clamp-1"
                >
                  {position.market?.title}
                </Link>
                <div className="flex items-center gap-3 text-sm">
                  <span className={position.side === 'YES' ? 'text-primary' : 'text-no'}>
                    {position.side}
                  </span>
                  <span className="text-muted">{formatUSDC(position.amountUsdc)}</span>
                  {position.profit !== null && position.profit !== undefined && (
                    <span className={parseFloat(position.profit) >= 0 ? 'text-primary' : 'text-no'}>
                      {parseFloat(position.profit) >= 0 ? '+' : ''}
                      {formatUSDC(position.profit)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm">No predictions yet</p>
        )}
      </div>
    </div>
  );
}

'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Gift, Info, Share2, Trophy } from 'lucide-react'
import PoolHistoryChart from './PoolHistoryChart'
import Timer from './Timer'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { calculatePayoutBreakdown, getWinningDirection } from '@/lib/payouts'
import { formatTradingAsset } from '@/lib/tradingAsset'

interface ResultsPageProps {
  question: string
  pollId: string
  voteDirection: 'YES' | 'NO'
  amount: number
  yesPercent: number
  noPercent: number
  yesPool: number
  noPool: number
  yesVotes?: number
  noVotes?: number
  claimedAt?: string | null
  payoutAmount?: number | null
  endsAt: string
  marketEnded?: boolean
  onBack: () => void
  onShare?: () => void
  onAddMore: () => void
  onChangeVote: () => void
  onClaimed?: (balance: number) => void | Promise<void>
}

export default function ResultsPage({
  question,
  pollId,
  voteDirection,
  amount,
  yesPercent,
  noPercent,
  yesPool,
  noPool,
  yesVotes,
  noVotes,
  claimedAt,
  payoutAmount,
  endsAt,
  marketEnded = false,
  onBack,
  onShare,
  onAddMore,
  onChangeVote,
  onClaimed,
}: ResultsPageProps) {
  const haptics = useHapticFeedback()
  const { initData, deviceFingerprint, updateBalance } = useTelegramUser()
  const [stakerCount, setStakerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [localClaimedAt, setLocalClaimedAt] = useState<string | null>(claimedAt || null)
  const [localPayout, setLocalPayout] = useState<number>(Number(payoutAmount || 0))

  useEffect(() => {
    const fetchStakers = async () => {
      try {
        const response = await fetch(`/api/polls/${pollId}/stats`)
        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'failed to fetch poll stats')
        setStakerCount(data.stakerCount || 0)
      } catch (err) {
        console.error('fetch stakers error:', err)
        setStakerCount(0)
      } finally {
        setLoading(false)
      }
    }

    fetchStakers()
  }, [pollId])

  const totalVolume = yesPool + noPool
  const winner = typeof yesVotes === 'number' && typeof noVotes === 'number'
    ? getWinningDirection(yesVotes, noVotes)
    : yesPercent > noPercent
      ? 'yes'
      : noPercent > yesPercent
        ? 'no'
        : 'draw'
  const normalizedVoteDirection = voteDirection === 'YES' ? 'yes' : 'no'
  const userWon = winner === 'draw' || winner === normalizedVoteDirection
  const payoutBreakdown = calculatePayoutBreakdown({
    voteAmount: amount,
    voteDirection: normalizedVoteDirection,
    winningDirection: winner,
    yesPool,
    noPool,
  })
  const displayClaimable = localClaimedAt ? localPayout : payoutBreakdown.claimablePayout
  const pnl = amount > 0 ? ((displayClaimable - amount) / amount) * 100 : 0
  const totalVotes = typeof yesVotes === 'number' && typeof noVotes === 'number' ? yesVotes + noVotes : stakerCount
  const winnerLabel = winner === 'draw' ? 'Draw' : `${winner.toUpperCase()} won`
  const statusLabel = marketEnded ? winnerLabel : 'Live'
  const hasClaimableReward = marketEnded && userWon && !localClaimedAt && displayClaimable > 0
  const outcomeTitle = winner === 'draw' ? 'Stake returned' : userWon ? 'Reward ready' : 'Market lost'
  const outcomeDescription = winner === 'draw'
    ? 'This market ended in a draw, so your stake is returned.'
    : userWon
      ? 'Your side had more voters. Claim to add this reward to your balance.'
      : 'Your side had fewer voters, so there is no reward to claim.'

  const handleClaim = async () => {
    try {
      setClaiming(true)
      setClaimError(null)
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, poll_id: pollId, device: deviceFingerprint }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'claim failed')

      setLocalClaimedAt(data.claimedAt)
      setLocalPayout(Number(data.payout || 0))
      if (typeof data.balance === 'number') {
        updateBalance(data.balance)
        await onClaimed?.(data.balance)
      }
      haptics.notification('success')
    } catch (error) {
      haptics.notification('error')
      setClaimError(error instanceof Error ? error.message : 'claim failed')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white text-xl"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              {onShare && (
                <button
                  onClick={onShare}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition active:scale-95 active:text-cyan-300"
                  title="Share market"
                >
                  <Share2 size={17} />
                </button>
              )}
              <Timer endsAt={endsAt} />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 mb-8">
            <p className={`text-sm font-bold mb-2 ${voteDirection === 'YES' ? 'text-cyan-400' : 'text-pink-500'}`}>
              You voted {voteDirection}
            </p>
            <p className="text-slate-400 text-sm mb-4">{formatTradingAsset(amount)} staked</p>
            <h2 className="text-white font-bold text-xl mb-4">{question}</h2>

            <div className="space-y-4 mb-6">
              <div className="h-12 bg-slate-700 rounded border border-cyan-500 flex items-center overflow-hidden">
                <div
                  className="h-full bg-cyan-500 flex items-center justify-end pr-2"
                  style={{ width: `${yesPercent}%` }}
                >
                  <span className="text-black text-xs font-bold">YES</span>
                </div>
              </div>

              <div className="h-12 bg-slate-700 rounded border border-pink-500 flex items-center overflow-hidden">
                <div
                  className="h-full bg-pink-500 flex items-center justify-end pr-2"
                  style={{ width: `${noPercent}%` }}
                >
                  <span className="text-black text-xs font-bold">NO</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between text-lg font-bold mb-4">
              <div className="text-center">
                <p className="text-cyan-400">YES {yesPercent}%</p>
                <p className="text-cyan-400 text-sm">{formatTradingAsset(yesPool)}</p>
              </div>
              <div className="text-center">
                <p className="text-pink-500">NO {noPercent}%</p>
                <p className="text-pink-500 text-sm">{formatTradingAsset(noPool)}</p>
              </div>
            </div>

            <p className="text-slate-400 text-xs">← swipe to add or change →</p>
          </div>

          <div className="mb-8">
            <p className="text-slate-400 text-xs mb-2">POOL HISTORY</p>
            <PoolHistoryChart pollId={pollId} yesPool={yesPool} noPool={noPool} />
          </div>

          <div className="mb-8 rounded-xl bg-slate-800 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {marketEnded ? 'Final result' : 'Market summary'}
              </p>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                marketEnded
                  ? winner === 'draw'
                    ? 'bg-slate-700 text-slate-300'
                    : winner === 'yes'
                      ? 'bg-cyan-400/10 text-cyan-400'
                      : 'bg-pink-500/10 text-pink-400'
                  : 'bg-cyan-400/10 text-cyan-400'
              }`}>
                {statusLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Your stake</p>
                <p className="font-bold text-white">{formatTradingAsset(amount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total pool</p>
                <p className="font-bold text-white">{formatTradingAsset(totalVolume)}</p>
              </div>
              {marketEnded ? (
                <div>
                  <p className="text-slate-500">Votes</p>
                  <p className="font-bold text-white">
                    {typeof yesVotes === 'number' && typeof noVotes === 'number'
                      ? `${yesVotes} YES / ${noVotes} NO`
                      : loading
                        ? 'loading...'
                        : totalVotes}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-slate-500">Votes</p>
                  <p className="font-bold text-white">Hidden until end</p>
                </div>
              )}
              <div>
                <p className="text-slate-500">Pool split</p>
                <p className="font-bold text-white">{yesPercent}% / {noPercent}%</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-white font-bold">
                  {marketEnded
                    ? loading ? 'loading...' : `${stakerCount} ${stakerCount === 1 ? 'person' : 'people'} staked`
                    : 'Votes hidden until market ends'}
                </p>
                <p className="text-slate-400 text-sm">{formatTradingAsset(totalVolume)} total volume</p>
              </div>
            </div>
          </div>

          {marketEnded && (
            <div className={`rounded-xl p-4 mb-8 border ${
              userWon
                ? 'bg-cyan-400/10 border-cyan-400/30'
                : 'bg-pink-500/10 border-pink-500/30'
            }`}>
              <div className="mb-4 flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  userWon ? 'bg-cyan-400 text-black' : 'bg-pink-500/20 text-pink-300'
                }`}>
                  {localClaimedAt ? <CheckCircle2 size={20} /> : userWon ? <Gift size={20} /> : <Trophy size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold uppercase tracking-wide ${userWon ? 'text-cyan-400' : 'text-pink-400'}`}>
                    {winner === 'draw' ? 'Draw' : userWon ? 'You won' : 'You lost'}
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">{localClaimedAt ? 'Reward claimed' : outcomeTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{outcomeDescription}</p>
                </div>
              </div>

              <p className="text-slate-400 text-xs uppercase tracking-wide">{localClaimedAt ? 'Claimed amount' : 'Claimable'}</p>
              <p className="text-white font-bold text-2xl">
                {userWon ? formatTradingAsset(displayClaimable) : formatTradingAsset(0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {userWon
                  ? 'Final amount after creator reward.'
                  : 'Your side did not win this market.'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Staked</p>
                  <p className="font-bold text-white">{formatTradingAsset(amount)}</p>
                </div>
                <div>
                  <p className="text-slate-500">P&L</p>
                  <p className={`font-bold ${pnl >= 0 ? 'text-cyan-400' : 'text-pink-400'}`}>
                    {userWon ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%` : '-100.0%'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Gross value</p>
                  <p className="font-bold text-slate-200">{formatTradingAsset(payoutBreakdown.grossPayout)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Creator reward</p>
                  <p className="font-bold text-slate-200">-{formatTradingAsset(payoutBreakdown.creatorRewardShare)}</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-3">
                {localClaimedAt
                  ? 'Claimed successfully'
                  : userWon
                    ? 'Ready to claim'
                    : 'Only winning votes can claim.'}
              </p>
              {claimError && <p className="text-pink-300 text-sm mt-3">{claimError}</p>}
              {hasClaimableReward && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="mt-4 w-full rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-black active:scale-95 transition disabled:opacity-60"
                >
                  {claiming ? 'Claiming...' : `Claim ${formatTradingAsset(displayClaimable)}`}
                </button>
              )}
            </div>
          )}

          {marketEnded && (
            <div className="mb-8 flex gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <Info size={18} className="mt-0.5 shrink-0 text-cyan-300" />
              <p className="text-sm leading-relaxed text-slate-400">
                Winners are decided by vote count. Pool size only affects how rewards are shared among the winning side.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-950 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-3 max-w-sm mx-auto">
          <button
            onClick={onAddMore}
            disabled={marketEnded}
            className={`flex-1 text-black font-bold py-3.5 rounded-2xl ${
              voteDirection === 'YES' ? 'bg-cyan-400 hover:bg-cyan-500' : 'bg-pink-500 hover:bg-pink-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            ADD {voteDirection}
          </button>
          <button
            onClick={onChangeVote}
            disabled={marketEnded}
            className={`flex-1 text-black font-bold py-3.5 rounded-2xl ${
              voteDirection === 'YES' ? 'bg-pink-500 hover:bg-pink-600' : 'bg-cyan-400 hover:bg-cyan-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            CHANGE {voteDirection === 'YES' ? 'NO' : 'YES'}
          </button>
        </div>
      </div>
    </div>
  )
}

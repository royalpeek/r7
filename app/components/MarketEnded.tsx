'use client'

import { useState } from 'react'
import PoolHistoryChart from './PoolHistoryChart'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { calculatePayoutBreakdown, getWinningDirection } from '@/lib/payouts'

interface MarketEndedProps {
  pollId: string
  question: string
  userVoteDirection: 'yes' | 'no'
  userVoteAmount: number
  claimedAt?: string | null
  payoutAmount?: number | null
  yesPool: number
  noPool: number
  yesVotes: number
  noVotes: number
  onBack: () => void
  onClaimed?: (balance: number) => void | Promise<void>
}

export default function MarketEnded({
  pollId,
  question,
  userVoteDirection,
  userVoteAmount,
  claimedAt,
  payoutAmount,
  yesPool,
  noPool,
  yesVotes,
  noVotes,
  onBack,
  onClaimed,
}: MarketEndedProps) {
  const haptics = useHapticFeedback()
  const { initData, updateBalance } = useTelegramUser()
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [localClaimedAt, setLocalClaimedAt] = useState<string | null>(claimedAt || null)
  const [localPayout, setLocalPayout] = useState<number>(Number(payoutAmount || 0))
  const totalVolume = yesPool + noPool
  const yesPercent = totalVolume > 0 ? Math.round((yesPool / totalVolume) * 100) : 0
  const noPercent = 100 - yesPercent
  const winner = getWinningDirection(yesVotes, noVotes)
  const userWon = winner === 'draw' || winner === userVoteDirection
  const payoutBreakdown = calculatePayoutBreakdown({
    voteAmount: userVoteAmount,
    voteDirection: userVoteDirection,
    winningDirection: winner,
    yesPool,
    noPool,
  })
  const displayClaimable = localClaimedAt ? localPayout : payoutBreakdown.claimablePayout
  const pnl = userVoteAmount > 0 ? ((displayClaimable - userVoteAmount) / userVoteAmount) * 100 : 0
  const winnerLabel = winner === 'draw' ? 'Draw' : `${winner.toUpperCase()} won`

  const handleClaim = async () => {
    try {
      setClaiming(true)
      setClaimError(null)
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, poll_id: pollId }),
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
    <div className="h-full w-full bg-slate-950 flex flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-slate-400 text-lg"
        >
          ← Back
        </button>
        <div className="bg-red-900 text-red-400 px-3 py-1 rounded text-sm font-mono">
          ENDED
        </div>
      </div>

      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {/* question */}
        <p className="text-white font-bold text-2xl leading-tight mb-6">{question}</p>

        {/* your vote */}
        <p className={`text-sm font-bold mb-4 ${userVoteDirection === 'yes' ? 'text-cyan-400' : 'text-pink-500'}`}>
          You voted {userVoteDirection === 'yes' ? 'YES' : 'NO'}
        </p>

        <div className={`rounded-xl p-4 mb-6 border ${
          userWon
            ? 'bg-cyan-400/10 border-cyan-400/30'
            : 'bg-pink-500/10 border-pink-500/30'
        }`}>
          <p className={`text-xs font-bold uppercase mb-1 ${userWon ? 'text-cyan-400' : 'text-pink-400'}`}>
            {winner === 'draw' ? 'Draw' : userWon ? 'You won' : 'You lost'}
          </p>
          <p className="text-slate-400 text-xs uppercase tracking-wide">Claimable</p>
          <p className="text-white font-bold text-2xl">
            {userWon ? `$${displayClaimable.toFixed(2)} USDT` : '$0.00 USDT'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {userWon
              ? 'Final amount after creator reward.'
              : 'Your side did not win this market.'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Staked</p>
              <p className="font-bold text-white">${userVoteAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">P&L</p>
              <p className={`font-bold ${pnl >= 0 ? 'text-cyan-400' : 'text-pink-400'}`}>
                {userWon ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%` : '-100.0%'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Gross value</p>
              <p className="font-bold text-slate-200">${payoutBreakdown.grossPayout.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Creator reward</p>
              <p className="font-bold text-slate-200">-${payoutBreakdown.creatorRewardShare.toFixed(2)}</p>
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
          {userWon && !localClaimedAt && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="mt-4 w-full rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-black active:scale-95 transition disabled:opacity-60"
            >
              {claiming ? 'Claiming...' : 'Claim winnings'}
            </button>
          )}
        </div>

        <div className="mb-6 rounded-xl bg-slate-800 p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Final result</p>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              winner === 'draw'
                ? 'bg-slate-700 text-slate-300'
                : winner === 'yes'
                  ? 'bg-cyan-400/10 text-cyan-400'
                  : 'bg-pink-500/10 text-pink-400'
            }`}>
              {winnerLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Your stake</p>
              <p className="font-bold text-white">${userVoteAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Total pool</p>
              <p className="font-bold text-white">${totalVolume.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Votes</p>
              <p className="font-bold text-white">{yesVotes} YES / {noVotes} NO</p>
            </div>
            <div>
              <p className="text-slate-500">Pool split</p>
              <p className="font-bold text-white">{yesPercent}% / {noPercent}%</p>
            </div>
          </div>
        </div>

        {/* vote counts and engagement */}
        <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="text-2xl">📊</div>
          <div>
            <p className="text-white font-bold">
              <span className="text-cyan-400">{yesVotes} YES</span>
              <span className="text-slate-400"> · </span>
              <span className="text-pink-500">{noVotes} NO</span>
            </p>
            <p className="text-slate-400 text-sm">${totalVolume.toFixed(2)} USDT total volume</p>
          </div>
        </div>

        {/* final price chart */}
        <div className="mb-6">
          <p className="text-slate-400 text-xs mb-2">POOL HISTORY</p>
          <PoolHistoryChart pollId={pollId} yesPool={yesPool} noPool={noPool} />
        </div>

        {/* pool breakdown */}
        <div className="mb-6">
          <p className="text-slate-400 text-xs mb-3">POOL BREAKDOWN</p>
          <div className="flex gap-4">
            <div className="flex-1 bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-cyan-400 font-bold text-2xl">${yesPool.toFixed(2)}</p>
              <p className="text-cyan-400 text-xs mt-1">YES Pool</p>
              <p className="text-slate-400 text-xs mt-2">{yesPercent}%</p>
            </div>
            <div className="flex-1 bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-pink-500 font-bold text-2xl">${noPool.toFixed(2)}</p>
              <p className="text-pink-500 text-xs mt-1">NO Pool</p>
              <p className="text-slate-400 text-xs mt-2">{noPercent}%</p>
            </div>
          </div>
        </div>

        {/* final outcome */}
        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-xs mb-2">FINAL OUTCOME</p>
          <div className="flex items-center gap-3">
            <div className="text-2xl">🏁</div>
            <div>
              <p className="text-white font-bold">
                {noVotes > yesVotes ? 'NO Won' : yesVotes > noVotes ? 'YES Won' : 'It\'s a Draw'}
              </p>
              <p className="text-slate-400 text-sm">
                {noVotes > yesVotes ? 'NO' : yesVotes > noVotes ? 'YES' : 'Both sides'} had more voters
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import ResultsPage from '../components/ResultsPage'
import StakingModal from '../components/StakingModal'
import Timer from '../components/Timer'
import { createPortal } from 'react-dom'
import { ArrowLeft, CheckCircle2, ChevronRight, Gift, Share2, Trophy } from 'lucide-react'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { getMarketLifecycleLabel, getMarketLifecycleStatus } from '@/lib/marketLifecycle'
import { getClaimablePositions, getPositionClaimBreakdown } from '@/lib/positionClaims'

type Position = {
  id: string
  poll_id: string
  question: string
  direction: 'yes' | 'no'
  amount: number
  status?: string | null
  ends_at: string
  created_at: string
  yes_pool: number
  no_pool: number
  yes_votes: number
  no_votes: number
  claimed_at?: string | null
  payout_amount?: number | null
}

type SortOption = 'newest' | 'oldest' | 'highest_stake' | 'lowest_stake'

type CreatorPoll = {
  id: string
  question: string
  category?: string | null
  status?: string | null
  yes_pool: number
  no_pool: number
  yes_votes: number
  no_votes: number
  ends_at: string
  created_at: string
  creator_reward_amount?: number | null
}

type CreatorStats = {
  totalFees: number
  totalPolls: number
  resolvedPolls: number
  pendingPolls: number
  avgPool: number
  avgVotes: number
  topPollReward: number
  topPollQuestion: string
}

export default function Portfolio() {
  const haptics = useHapticFeedback()
  const [activeTab, setActiveTab] = useState(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('claim') === '1'
      ? 'history'
      : 'active'
  ))
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  const {
    userId,
    appUser,
    initData,
    deviceFingerprint,
    authError,
    loading: userLoading,
    updateBalance,
    retryAuth,
  } = useTelegramUser()
  const balance = Number(appUser?.balance ?? 0)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'yes' | 'no' | null>(null)
  const [stakingMode, setStakingMode] = useState<'new' | 'add' | 'change'>('new')
  const [claimingPositionId, setClaimingPositionId] = useState<string | null>(null)
  const [showPerformance, setShowPerformance] = useState(false)
  const [performanceTab, setPerformanceTab] = useState<'performance' | 'creator'>('performance')
  const [creatorStats, setCreatorStats] = useState<CreatorStats | null>(null)
  const [creatorPolls, setCreatorPolls] = useState<CreatorPoll[]>([])
  const [creatorLoading, setCreatorLoading] = useState(false)
  const userRole = appUser?.role || (appUser?.is_creator ? 'creator' : 'user')
  const canViewCreatorStats = userRole === 'creator' || userRole === 'admin'

  const getOutcomeLabel = (position: Position) => {
    const breakdown = getPositionClaimBreakdown(position)
    if (breakdown.winner === 'draw') return 'Draw'
    return breakdown.userWon ? 'Won' : 'Lost'
  }

  const getOutcomeClass = (position: Position) => {
    const label = getOutcomeLabel(position)
    if (label === 'Won') return 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30'
    if (label === 'Draw') return 'bg-slate-800 text-slate-300 border-slate-700'
    return 'bg-pink-500/10 text-pink-300 border-pink-500/30'
  }

  const fetchPositions = useCallback(async () => {
    try {
      if (!userId) return []
      setLoading(true)
      setLoadError(null)
      const response = await fetch('/api/me/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to fetch positions')
      const nextPositions = (data.positions || []) as Position[]
      setPositions(nextPositions)
      return nextPositions
    } catch (err) {
      console.error('fetch error:', err)
      setLoadError(err instanceof Error ? err.message : 'failed to fetch positions')
      return []
    } finally {
      setLoading(false)
    }
  }, [initData, userId])

  useEffect(() => {
    if (userLoading) return

    const timeout = window.setTimeout(() => {
      if (userId) {
        fetchPositions()
        return
      }

      setLoading(false)
      setPositions([])
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [fetchPositions, userId, userLoading])

  const handleConfirmVote = async (amount: number) => {
    if (!stakingDirection || !selectedPosition || !userId) return
    try {
      setVoteError(null)
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          poll_id: selectedPosition.poll_id,
          direction: stakingDirection,
          amount,
          mode: stakingMode,
          device: deviceFingerprint,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'vote failed')
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (typeof data.balance === 'number') updateBalance(data.balance)
      haptics.notification('success')
      setShowStakingModal(false)
      setStakingDirection(null)
      setStakingMode('new')
      const nextPositions = await fetchPositions()
      const nextSelectedPosition = nextPositions.find(position => position.poll_id === selectedPosition.poll_id)
      if (nextSelectedPosition) {
        setSelectedPosition(nextSelectedPosition)
      }
    } catch (error) {
      haptics.notification('error')
      console.error('vote error:', error)
      setVoteError(error instanceof Error ? error.message : 'vote failed. try again.')
    }
  }

  const now = new Date()
  const active = positions.filter(p => getMarketLifecycleStatus(p.status, p.ends_at, now) === 'live')
  const history = positions.filter(p => {
    const status = getMarketLifecycleStatus(p.status, p.ends_at, now)
    return status === 'ended' || status === 'closed' || status === 'archived'
  })
  const claimablePositions = getClaimablePositions(positions)
  const totalClaimable = claimablePositions.reduce((sum, position) => {
    return sum + getPositionClaimBreakdown(position).claimablePayout
  }, 0)

  const claimPosition = async (position: Position) => {
    try {
      haptics.impact('medium')
      setClaimingPositionId(position.id)
      setClaimError(null)
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          poll_id: position.poll_id,
          device: deviceFingerprint,
        }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'claim failed')

      if (typeof data.balance === 'number') updateBalance(data.balance)
      haptics.notification('success')
      await fetchPositions()
    } catch (error) {
      haptics.notification('error')
      setClaimError(error instanceof Error ? error.message : 'claim failed')
    } finally {
      setClaimingPositionId(null)
    }
  }

  const fetchCreatorStats = useCallback(async () => {
    if (!canViewCreatorStats) return

    try {
      setCreatorLoading(true)
      const response = await fetch('/api/me/creator-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to fetch creator stats')
      setCreatorStats(data.stats)
      setCreatorPolls(data.polls || [])
    } catch (error) {
      console.error('creator stats error:', error)
    } finally {
      setCreatorLoading(false)
    }
  }, [canViewCreatorStats, initData])

  const sortLabel: Record<SortOption, string> = {
    newest: 'Newest',
    oldest: 'Oldest',
    highest_stake: 'Highest Stake',
    lowest_stake: 'Lowest Stake',
  }

  const sortPositions = (list: Position[]) => [...list].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sortBy === 'highest_stake') return b.amount - a.amount
    if (sortBy === 'lowest_stake') return a.amount - b.amount
    return 0
  })

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  const resolvedPositions = history.filter(position => {
    const status = getMarketLifecycleStatus(position.status, position.ends_at, now)
    return status === 'ended' || status === 'closed'
  })
  const totalResolvedStaked = resolvedPositions.reduce((sum, position) => sum + position.amount, 0)
  const totalResolvedValue = resolvedPositions.reduce((sum, position) => {
    if (position.claimed_at) return sum + Number(position.payout_amount || 0)
    return sum + getPositionClaimBreakdown(position).claimablePayout
  }, 0)
  const performanceProfit = Number((totalResolvedValue - totalResolvedStaked).toFixed(2))
  const performanceWins = resolvedPositions.filter(position => {
    const breakdown = getPositionClaimBreakdown(position)
    return breakdown.userWon && breakdown.winner !== 'draw'
  }).length
  const performanceDraws = resolvedPositions.filter(position => getPositionClaimBreakdown(position).winner === 'draw').length
  const performanceLosses = Math.max(0, resolvedPositions.length - performanceWins - performanceDraws)
  const performance = {
    profit: performanceProfit,
    totalResolvedStaked,
    pnlPercent: totalResolvedStaked > 0 ? (performanceProfit / totalResolvedStaked) * 100 : 0,
    wins: performanceWins,
    losses: performanceLosses,
    draws: performanceDraws,
    winRate: resolvedPositions.length > 0 ? Math.round((performanceWins / resolvedPositions.length) * 100) : 0,
    markets: positions.length,
  }

  const openPerformance = () => {
    haptics.selection()
    setShowPerformance(true)
    if (canViewCreatorStats) fetchCreatorStats()
  }

  if (showPerformance) {
    return (
      <div className="h-screen overflow-hidden bg-slate-950 text-white">
        <div className="flex-shrink-0 bg-slate-950 px-4 pt-5 pb-4">
          <div className="mb-5 flex items-center justify-between">
            <button
              onClick={() => {
                haptics.selection()
                setShowPerformance(false)
              }}
              className="rounded-full p-2 text-slate-300 active:scale-95 transition"
              title="Back"
            >
              <ArrowLeft size={26} />
            </button>
            <h1 className="text-2xl font-bold">Performance</h1>
            <div className="w-10" />
          </div>

          <div className="grid grid-cols-2 rounded-2xl bg-slate-900 p-1">
            <button
              onClick={() => {
                haptics.selection()
                setPerformanceTab('performance')
              }}
              className={`rounded-xl py-3 text-sm font-bold transition ${
                performanceTab === 'performance' ? 'bg-slate-950 text-cyan-400' : 'text-slate-400'
              }`}
            >
              Performance
            </button>
            <button
              disabled={!canViewCreatorStats}
              onClick={() => {
                haptics.selection()
                setPerformanceTab('creator')
                fetchCreatorStats()
              }}
              className={`rounded-xl py-3 text-sm font-bold transition disabled:opacity-40 ${
                performanceTab === 'creator' ? 'bg-slate-950 text-cyan-400' : 'text-slate-400'
              }`}
            >
              Creator
            </button>
          </div>
        </div>

        <div className="h-[calc(100vh-9.5rem)] overflow-y-auto px-4 pb-28 pt-4">
          {performanceTab === 'performance' ? (
          <>
            <div className="mb-7 text-center">
              <p className={`text-5xl font-bold ${performance.profit >= 0 ? 'text-cyan-400' : 'text-pink-500'}`}>
                {performance.profit >= 0 ? '+' : '-'}${Math.abs(performance.profit).toFixed(2)}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                <span className={`rounded-xl px-3 py-2 font-bold ${
                  performance.pnlPercent >= 0 ? 'bg-cyan-400/10 text-cyan-400' : 'bg-pink-500/10 text-pink-400'
                }`}>
                  {performance.pnlPercent >= 0 ? '+' : ''}{performance.pnlPercent.toFixed(1)}%
                </span>
                <span className="font-semibold text-slate-400">on ${performance.totalResolvedStaked.toFixed(2)} staked</span>
              </div>
            </div>

            <PerformanceChart value={performance.profit} />

            <div className="mt-7 grid grid-cols-2 gap-4">
              <MetricCard label="ATH Gain" value={`+$${Math.max(0, performance.profit).toFixed(2)}`} accent />
              <MetricCard label="Best Day" value={performance.profit > 0 ? `+$${performance.profit.toFixed(2)}` : '--'} accent={performance.profit > 0} />
              <MetricCard label="Win Rate" value={`${performance.winRate}%`} sub={`${performance.wins}W / ${performance.losses}L / ${performance.draws}D`} />
              <MetricCard label="Best Streak" value={performance.wins} sub="wins tracked" accent />
              <MetricCard label="Markets" value={performance.markets} sub="total played" />
              <MetricCard label="Worst Dip" value={performance.profit < 0 ? `-$${Math.abs(performance.profit).toFixed(2)}` : '--'} danger={performance.profit < 0} />
            </div>
          </>
        ) : (
          <>
            <div className="mb-7 text-center">
              <p className="text-5xl font-bold text-cyan-400">
                ${Number(creatorStats?.totalFees || 0).toFixed(2)}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                <span className="rounded-xl bg-cyan-400/10 px-3 py-2 font-bold text-cyan-400">
                  {creatorStats?.totalPolls ?? 0} markets
                </span>
                <span className="font-semibold text-slate-400">
                  {creatorStats?.resolvedPolls ?? 0} resolved · all-time creator fees
                </span>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-4 rounded-2xl bg-slate-900 p-1 text-sm font-bold text-slate-400">
              {['7D', '30D', '90D', 'All'].map(range => (
                <button
                  key={range}
                  className={`rounded-xl py-3 ${range === 'All' ? 'bg-slate-950 text-cyan-400' : ''}`}
                >
                  {range}
                </button>
              ))}
            </div>

            <PerformanceChart value={creatorStats?.totalFees || 0} />

            <div className="mt-7 grid grid-cols-2 gap-4">
              <MetricCard label="All-time fees" value={`$${Number(creatorStats?.totalFees || 0).toFixed(2)}`} sub={`${creatorStats?.resolvedPolls ?? 0} resolved`} accent />
              <MetricCard label="Avg pool" value={`$${Number(creatorStats?.avgPool || 0).toFixed(0)}`} sub="per market" />
              <MetricCard label="Avg votes" value={creatorStats?.avgVotes ?? 0} sub="per market" />
              <MetricCard label="Top market" value={`$${Number(creatorStats?.topPollReward || 0).toFixed(2)}`} sub={creatorStats?.topPollQuestion || 'No resolved market'} accent />
              <MetricCard label="Markets created" value={creatorStats?.totalPolls ?? 0} sub="all time" />
              <MetricCard label="Pending" value={creatorStats?.pendingPolls ?? 0} sub="not yet resolved" />
            </div>

            <div className="mt-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">Markets</h2>
              <div className="space-y-3">
                {creatorLoading ? (
                  <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-400">loading creator stats...</p>
                ) : creatorPolls.length === 0 ? (
                  <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-400">No creator markets yet.</p>
                ) : creatorPolls.map(poll => {
                  const totalPool = Number(poll.yes_pool || 0) + Number(poll.no_pool || 0)
                  const totalVotes = Number(poll.yes_votes || 0) + Number(poll.no_votes || 0)
                  const reward = Number(poll.creator_reward_amount || 0)
                  const status = getMarketLifecycleStatus(poll.status, poll.ends_at)

                  return (
                    <div key={poll.id} className="rounded-2xl bg-slate-900 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex-1 text-sm font-bold text-white">{poll.question}</p>
                        <p className="text-sm font-bold text-cyan-400">
                          {reward > 0 ? `$${reward.toFixed(2)}` : '--'}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-md border border-slate-700 px-2 py-0.5 text-slate-300">{getMarketLifecycleLabel(status)}</span>
                        <span>{poll.category || 'general'}</span>
                        <span>${totalPool.toFixed(2)} pool</span>
                        <span>{totalVotes} votes</span>
                        <span>{formatDate(poll.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

          <button className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-400 py-4 text-base font-bold text-black active:scale-95 transition">
            <Share2 size={18} />
            Share Stats
          </button>
        </div>
      </div>
    )
  }

  // show results page when a card is tapped
  if (selectedPosition) {
    const totalPool = selectedPosition.yes_pool + selectedPosition.no_pool
    const yesPercent = totalPool > 0 ? Math.round((selectedPosition.yes_pool / totalPool) * 100) : 50
    const noPercent = 100 - yesPercent
    const selectedStatus = getMarketLifecycleStatus(selectedPosition.status, selectedPosition.ends_at, now)
    const marketEnded = selectedStatus !== 'live'

    return (
      <>
        <ResultsPage
          question={selectedPosition.question}
          pollId={selectedPosition.poll_id}
          voteDirection={selectedPosition.direction === 'yes' ? 'YES' : 'NO'}
          amount={selectedPosition.amount}
          yesPercent={yesPercent}
          noPercent={noPercent}
          yesPool={selectedPosition.yes_pool}
          noPool={selectedPosition.no_pool}
          yesVotes={selectedPosition.yes_votes}
          noVotes={selectedPosition.no_votes}
          claimedAt={selectedPosition.claimed_at}
          payoutAmount={selectedPosition.payout_amount}
          endsAt={selectedPosition.ends_at}
          marketEnded={marketEnded}
          onBack={() => {
            haptics.selection()
            setSelectedPosition(null)
          }}
            onAddMore={() => {
              if (marketEnded) return
              haptics.impact('medium')
              setVoteError(null)
              setStakingDirection(selectedPosition.direction)
              setStakingMode('add')
              setShowStakingModal(true)
            }}
            onChangeVote={() => {
              if (marketEnded) return
              haptics.impact('medium')
              setVoteError(null)
              setStakingDirection(selectedPosition.direction === 'yes' ? 'no' : 'yes')
              setStakingMode('change')
              setShowStakingModal(true)
            }}
            onClaimed={async balance => {
              updateBalance(balance)
              const nextPositions = await fetchPositions()
              const nextSelectedPosition = nextPositions.find(position => position.poll_id === selectedPosition.poll_id)
              if (nextSelectedPosition) setSelectedPosition(nextSelectedPosition)
            }}
          />
          {voteError && (
            <div className="fixed left-4 right-4 top-4 z-[70] mx-auto max-w-sm rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-center text-sm text-pink-200">
              {voteError}
            </div>
          )}
        {showStakingModal && stakingDirection && typeof document !== 'undefined' &&
          createPortal(
            <StakingModal
              question={selectedPosition.question}
              voteDirection={stakingDirection === 'yes' ? 'YES' : 'NO'}
              availableBalance={balance}
              replacementCredit={stakingDirection !== selectedPosition.direction ? Number(selectedPosition.amount || 0) : 0}
              yesPool={selectedPosition.yes_pool}
              noPool={selectedPosition.no_pool}
              existingVoteDirection={selectedPosition.direction}
              existingVoteAmount={Number(selectedPosition.amount || 0)}
              mode={stakingMode}
              onConfirm={handleConfirmVote}
              onCancel={() => { setShowStakingModal(false); setStakingDirection(null); setStakingMode('new') }}
            />,
            document.body
          )}
      </>
    )
  }

  if (authError) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 px-6 text-center">
        <div className="max-w-sm rounded-3xl border border-pink-500/30 bg-slate-900 p-6">
          <p className="text-xl font-bold text-white">Account locked</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{authError}</p>
          <button
            type="button"
            onClick={retryAuth}
            className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black active:scale-95 transition"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-950 h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-slate-950 px-4 pt-2 pb-0 space-y-2.5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Balance</p>
          <p className="text-white text-3xl font-bold">
            ${balance.toFixed(2)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={openPerformance}
            className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-left active:scale-[0.99] transition"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-slate-400 text-xs">P&L</p>
              <ChevronRight size={14} className="text-slate-500" />
            </div>
            <p className={`text-xl font-bold ${performance.profit >= 0 ? 'text-cyan-400' : 'text-pink-500'}`}>
              {loading ? '...' : `${performance.profit >= 0 ? '+' : '-'}$${Math.abs(performance.profit).toFixed(2)}`}
            </p>
          </button>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-slate-400 text-xs mb-1">Claimable</p>
            <p className={`text-xl font-bold ${totalClaimable > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
              {loading ? '...' : `$${totalClaimable.toFixed(2)}`}
            </p>
          </div>
        </div>

        {!loading && totalClaimable > 0 && (
          <button
            onClick={() => {
              haptics.selection()
              setActiveTab('history')
            }}
            className="flex w-full items-center justify-between rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-left active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-cyan-300">
              <Gift size={16} />
              {claimablePositions.length} reward{claimablePositions.length === 1 ? '' : 's'} ready
            </span>
            <span className="text-sm font-bold text-white">${totalClaimable.toFixed(2)}</span>
          </button>
        )}

        <div className="flex items-center justify-between border-b border-slate-700">
          <div className="flex gap-4">
            <button
              onClick={() => {
                haptics.selection()
                setActiveTab('active')
              }}
              className={`pb-3 text-sm font-semibold ${activeTab === 'active' ? 'text-white border-b-2 border-cyan-400' : 'text-slate-400'}`}
            >
              Active ({loading ? '...' : active.length})
            </button>
            <button
              onClick={() => {
                haptics.selection()
                setActiveTab('history')
              }}
              className={`pb-3 text-sm font-semibold ${activeTab === 'history' ? 'text-white border-b-2 border-cyan-400' : 'text-slate-400'}`}
            >
              History ({loading ? '...' : history.length})
            </button>
          </div>

          <div className="relative pb-3">
            <button
              onClick={() => {
                haptics.selection()
                setShowSortMenu(!showSortMenu)
              }}
              className="text-slate-400 text-sm flex items-center gap-1"
            >
              ↕ {sortLabel[sortBy]}
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded-xl z-10 w-44 overflow-hidden">
                {(Object.keys(sortLabel) as SortOption[]).map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      haptics.selection()
                      setSortBy(option)
                      setShowSortMenu(false)
                    }}
                    className={`w-full text-left px-4 py-3 text-sm ${sortBy === option ? 'text-cyan-400 bg-slate-700' : 'text-slate-300'}`}
                  >
                    {sortLabel[option]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-32">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
            <p className="text-slate-500 text-sm">loading portfolio...</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-white font-semibold">Could not load portfolio</p>
            <p className="text-slate-500 text-sm">{loadError}</p>
            <button
              onClick={() => {
                haptics.selection()
                fetchPositions()
              }}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black active:scale-95 transition"
            >
              Retry
            </button>
          </div>
        ) : activeTab === 'active' ? (
          <div className="space-y-4">
            {active.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-white font-semibold">No active positions</p>
                <p className="text-slate-500 text-sm mt-2">Votes you place on live markets will appear here.</p>
              </div>
            ) : sortPositions(active).map(pos => {
              const status = getMarketLifecycleStatus(pos.status, pos.ends_at, now)

              return (
              <div
                key={pos.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer active:opacity-70"
                onClick={() => {
                  haptics.selection()
                  setSelectedPosition(pos)
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-white font-semibold text-sm flex-1 pr-4">{pos.question}</p>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-bold uppercase text-black">
                      {getMarketLifecycleLabel(status)}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${pos.direction === 'yes' ? 'bg-cyan-900 text-cyan-400' : 'bg-pink-900 text-pink-400'}`}>
                      {pos.direction.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-slate-400">Stake: <span className="text-white font-bold">${pos.amount}</span></span>
                  <span className="text-slate-500 text-xs">tap to view</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-full bg-slate-700 rounded-full h-1.5 mr-4">
                    <div className="bg-cyan-400 h-1.5 rounded-full w-1/2" />
                  </div>
                  <Timer endsAt={pos.ends_at} onExpire={() => fetchPositions()} />
                </div>
              </div>
            )})}
          </div>
        ) : (
          <div className="space-y-4">
            {claimError && (
              <div className="rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
                {claimError}
              </div>
            )}
            {activeTab === 'history' && claimablePositions.length > 0 && (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                ${totalClaimable.toFixed(2)} ready to claim across {claimablePositions.length} market{claimablePositions.length === 1 ? '' : 's'}.
              </div>
            )}
            {history.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-white font-semibold">No history yet</p>
                <p className="text-slate-500 text-sm mt-2">Ended markets you joined will appear here.</p>
              </div>
            ) : sortPositions(history).map(pos => {
              const status = getMarketLifecycleStatus(pos.status, pos.ends_at, now)
              const claimBreakdown = getPositionClaimBreakdown(pos)
              const canClaim = claimablePositions.some(position => position.id === pos.id)
              const outcomeLabel = getOutcomeLabel(pos)
              const claimValue = pos.claimed_at ? Number(pos.payout_amount || 0) : claimBreakdown.claimablePayout

              return (
              <div
                key={pos.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer active:opacity-70"
                onClick={() => {
                  haptics.selection()
                  setSelectedPosition(pos)
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-white font-semibold text-sm flex-1 pr-4">{pos.question}</p>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getOutcomeClass(pos)}`}>
                      {outcomeLabel}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${pos.direction === 'yes' ? 'bg-cyan-900 text-cyan-400' : 'bg-pink-900 text-pink-400'}`}>
                      {pos.direction.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-400">Stake: <span className="text-white font-bold">${pos.amount}</span></span>
                  <span className={`text-xs font-bold ${claimValue > 0 ? 'text-cyan-300' : 'text-slate-500'}`}>
                    {pos.claimed_at ? `Claimed $${claimValue.toFixed(2)}` : canClaim ? `Ready $${claimValue.toFixed(2)}` : 'tap to view'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">{formatDate(pos.created_at)}</span>
                  <span className="text-slate-500 text-xs">{getMarketLifecycleLabel(status)}</span>
                </div>
                {canClaim && (
                  <button
                    disabled={claimingPositionId === pos.id}
                    onClick={event => {
                      event.stopPropagation()
                      claimPosition(pos)
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 text-sm font-bold text-black active:scale-95 transition disabled:opacity-60"
                  >
                    <Gift size={16} />
                    {claimingPositionId === pos.id
                      ? 'Claiming...'
                      : `Claim $${claimBreakdown.claimablePayout.toFixed(2)}`}
                  </button>
                )}
                {pos.claimed_at && (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 py-3 text-sm font-bold text-cyan-200">
                    <CheckCircle2 size={16} />
                    Claimed
                  </div>
                )}
                {!canClaim && !pos.claimed_at && outcomeLabel === 'Lost' && (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 py-3 text-sm font-bold text-slate-500">
                    <Trophy size={16} />
                    No reward
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}

function PerformanceChart({ value }: { value: number }) {
  const positive = value >= 0
  const points = positive
    ? '5,86 25,80 45,78 65,72 85,70 105,66 125,62 145,54 165,45 185,35 205,30 225,22 245,16'
    : '5,42 25,47 45,51 65,55 85,60 105,64 125,70 145,73 165,78 185,82 205,86 225,88 245,90'

  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="relative h-56 overflow-hidden rounded-xl bg-slate-950/50">
        <div className="absolute inset-x-4 top-8 border-t border-slate-800" />
        <div className="absolute inset-x-4 top-24 border-t border-slate-800" />
        <div className="absolute inset-x-4 bottom-8 border-t border-dashed border-slate-600" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 250 110" preserveAspectRatio="none">
          <defs>
            <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={positive ? '#22d3ee' : '#ec4899'} stopOpacity="0.45" />
              <stop offset="100%" stopColor={positive ? '#22d3ee' : '#ec4899'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`5,100 ${points} 245,100`} fill="url(#performanceFill)" />
          <polyline points={points} fill="none" stroke={positive ? '#22d3ee' : '#ec4899'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="245" cy={positive ? '16' : '90'} r="5" fill={positive ? '#22d3ee' : '#ec4899'} />
        </svg>
        <div className="absolute bottom-3 left-4 right-4 flex justify-between text-xs font-bold text-slate-600">
          <span>Start</span>
          <span>Now</span>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  accent = false,
  danger = false,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className="min-h-28 rounded-2xl bg-slate-900 p-4">
      <p className="mb-4 text-sm font-bold text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${danger ? 'text-pink-500' : accent ? 'text-cyan-400' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="mt-2 text-sm font-semibold text-slate-500">{sub}</p>}
    </div>
  )
}

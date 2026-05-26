'use client'

import { useCallback, useEffect, useState } from 'react'
import ResultsPage from '../components/ResultsPage'
import StakingModal from '../components/StakingModal'
import Timer from '../components/Timer'
import { createPortal } from 'react-dom'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'

type Position = {
  id: string
  poll_id: string
  question: string
  direction: 'yes' | 'no'
  amount: number
  ends_at: string
  created_at: string
  yes_pool: number
  no_pool: number
}

type SortOption = 'newest' | 'oldest' | 'highest_stake' | 'lowest_stake'

export default function Portfolio() {
  const haptics = useHapticFeedback()
  const [activeTab, setActiveTab] = useState('active')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { userId, appUser, initData, updateBalance } = useTelegramUser()
  const balance = Number(appUser?.balance ?? 0)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'yes' | 'no' | null>(null)

  const fetchPositions = useCallback(async () => {
    try {
      if (!userId) return
      setLoading(true)
      setError(null)
      const response = await fetch('/api/me/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to fetch positions')
      setPositions((data.positions || []) as Position[])
    } catch (err) {
      console.error('fetch error:', err)
      setError(err instanceof Error ? err.message : 'failed to fetch positions')
    } finally {
      setLoading(false)
    }
  }, [initData, userId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchPositions()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [fetchPositions])

  const handleConfirmVote = async (amount: number) => {
    if (!stakingDirection || !selectedPosition || !userId) return
    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          poll_id: selectedPosition.poll_id,
          direction: stakingDirection,
          amount,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'vote failed')
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (typeof data.balance === 'number') updateBalance(data.balance)
      haptics.notification('success')
      setShowStakingModal(false)
      setStakingDirection(null)
      await fetchPositions()
    } catch (error) {
      haptics.notification('error')
      console.error('vote error:', error)
      alert('vote failed. try again.')
    }
  }

  const now = new Date()
  const active = positions.filter(p => p.ends_at && new Date(p.ends_at) > now)
  const history = positions.filter(p => p.ends_at && new Date(p.ends_at) <= now)
  const totalStaked = positions.reduce((sum, p) => sum + p.amount, 0)

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

  // show results page when a card is tapped
  if (selectedPosition) {
    const totalPool = selectedPosition.yes_pool + selectedPosition.no_pool
    const yesPercent = totalPool > 0 ? Math.round((selectedPosition.yes_pool / totalPool) * 100) : 50
    const noPercent = 100 - yesPercent
    const marketEnded = new Date(selectedPosition.ends_at) <= now

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
          endsAt={selectedPosition.ends_at}
          marketEnded={marketEnded}
          onBack={() => {
            haptics.selection()
            setSelectedPosition(null)
          }}
          onAddMore={() => {
            haptics.impact('medium')
            setStakingDirection(selectedPosition.direction)
            setShowStakingModal(true)
          }}
          onChangeVote={() => {
            haptics.impact('medium')
            setStakingDirection(selectedPosition.direction === 'yes' ? 'no' : 'yes')
            setShowStakingModal(true)
          }}
        />
        {showStakingModal && stakingDirection && typeof document !== 'undefined' &&
          createPortal(
            <StakingModal
              question={selectedPosition.question}
              voteDirection={stakingDirection === 'yes' ? 'YES' : 'NO'}
              availableBalance={balance}
              onConfirm={handleConfirmVote}
              onCancel={() => { setShowStakingModal(false); setStakingDirection(null) }}
            />,
            document.body
          )}
      </>
    )
  }

  return (
    <div className="bg-slate-950 h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-slate-950 px-4 pt-2 pb-0 space-y-2.5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Total Staked</p>
          <p className="text-white text-3xl font-bold">
            {loading ? '...' : `$${totalStaked.toLocaleString()}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-slate-400 text-xs mb-1">P&L</p>
            <p className="text-slate-500 text-xl font-bold">--</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-slate-400 text-xs mb-1">Claimable</p>
            <p className="text-slate-500 text-xl font-bold">--</p>
          </div>
        </div>

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
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-white font-semibold">Could not load portfolio</p>
            <p className="text-slate-500 text-sm">Your positions did not load.</p>
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
            ) : sortPositions(active).map(pos => (
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
                  <span className={`text-xs font-bold px-2 py-1 rounded ${pos.direction === 'yes' ? 'bg-cyan-900 text-cyan-400' : 'bg-pink-900 text-pink-400'}`}>
                    {pos.direction.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-slate-400">Stake: <span className="text-white font-bold">${pos.amount}</span></span>
                  <span className="text-slate-500 text-xs">tap to view</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-full bg-slate-700 rounded-full h-1.5 mr-4">
                    <div className="bg-cyan-400 h-1.5 rounded-full w-1/2" />
                  </div>
                  <Timer endsAt={pos.ends_at} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-white font-semibold">No history yet</p>
                <p className="text-slate-500 text-sm mt-2">Ended markets you joined will appear here.</p>
              </div>
            ) : sortPositions(history).map(pos => (
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
                  <span className={`text-xs font-bold px-2 py-1 rounded ${pos.direction === 'yes' ? 'bg-cyan-900 text-cyan-400' : 'bg-pink-900 text-pink-400'}`}>
                    {pos.direction.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-400">Stake: <span className="text-white font-bold">${pos.amount}</span></span>
                  <span className="text-slate-500 text-xs">tap to view</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">{formatDate(pos.created_at)}</span>
                  <span className="text-slate-500 text-xs">resolution pending</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

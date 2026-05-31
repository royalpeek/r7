'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2 } from 'lucide-react'
import StakingModal from './StakingModal'
import ResultsPage from './ResultsPage'
import MarketEnded from './MarketEnded'
import PoolHistoryChart from './PoolHistoryChart'
import Timer from './Timer'
import Toast from './Toast'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { useMarketShare } from '@/app/hooks/useMarketShare'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { usePolls } from '@/app/hooks/usePolls'
import { getMarketLifecycleLabel, getMarketLifecycleStatus } from '@/lib/marketLifecycle'

type Poll = {
  id: string
  question: string
  yes_votes: number
  no_votes: number
  yes_pool: number
  no_pool: number
  category?: string | null
  status?: string | null
  ends_at: string
}

type PollCardProps = {
  polls: Poll[]
  focusPollId?: string | null
  availableBalance?: number
  onDetailChange?: (showDetail: boolean) => void
  onPollsChange?: () => void | Promise<void>
  onBalanceChange?: (balance: number) => void
}

export default function PollCard({ polls, focusPollId = null, availableBalance = 0, onDetailChange, onPollsChange, onBalanceChange }: PollCardProps) {
  const haptics = useHapticFeedback()
  const { shareFeedback, clearShareFeedback, shareMarket } = useMarketShare()
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentCard = polls && polls.length > 0 ? polls[currentIndex] : null
  const openedFocusPollId = useRef<string | null>(null)

  const { userId, initData, deviceFingerprint, updateBalance } = useTelegramUser()
  const { userVotes, refetch } = usePolls(userId, initData)

  const userVote = currentCard ? userVotes.find(v => v.poll_id === currentCard.id) : null

  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'yes' | 'no' | null>(null)
  const [stakingMode, setStakingMode] = useState<'new' | 'add' | 'change'>('new')
  const [showDetail, setShowDetail] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

  useEffect(() => {
    if (polls.length === 0 || currentIndex < polls.length) return

    const timeout = window.setTimeout(() => {
      setCurrentIndex(0)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [currentIndex, polls.length])

  useEffect(() => {
    if (!focusPollId || openedFocusPollId.current === focusPollId) return

    const targetIndex = polls.findIndex(poll => poll.id === focusPollId)
    if (targetIndex < 0) return

    const timeout = window.setTimeout(() => {
      openedFocusPollId.current = focusPollId
      setCurrentIndex(targetIndex)
      setShowDetail(true)
      onDetailChange?.(true)
      haptics.impact('light')
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [focusPollId, haptics, onDetailChange, polls])

  const updateShowDetail = (nextShowDetail: boolean) => {
    if (nextShowDetail) haptics.impact('light')
    else haptics.selection()
    setShowDetail(nextShowDetail)
    onDetailChange?.(nextShowDetail)
  }

  const openStakingModal = (direction: 'yes' | 'no', mode?: 'new' | 'add' | 'change') => {
    haptics.impact('medium')
    setVoteError(null)
    setStakingDirection(direction)
    setStakingMode(mode || (userVote ? direction === userVote.direction ? 'add' : 'change' : 'new'))
    setShowStakingModal(true)
  }

  // detail page swipe state
  const detailStartPos = useRef({ x: 0, y: 0 })
  const [detailDragging, setDetailDragging] = useState(false)
  const [detailDeltaX, setDetailDeltaX] = useState(0)
  const [detailAxis, setDetailAxis] = useState<'x' | 'y' | null>(null)

  // main deck swipe state
  const deckRef = useRef<HTMLDivElement | null>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [axis, setAxis] = useState<'x' | 'y' | null>(null)
  const [deltaX, setDeltaX] = useState(0)
  const [deltaY, setDeltaY] = useState(0)

  const resetDrag = () => {
    setDragging(false)
    setAxis(null)
    setDeltaX(0)
    setDeltaY(0)
  }

  const resetDetailDrag = () => {
    setDetailDragging(false)
    setDetailAxis(null)
    setDetailDeltaX(0)
  }

  // detail page swipe handlers
  const onDetailTouchStart = (e: React.TouchEvent) => {
    if (showStakingModal) return
    if (e.touches.length > 1) return
    detailStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setDetailDragging(true)
    setDetailAxis(null)
    setDetailDeltaX(0)
  }

  const onDetailTouchMove = (e: React.TouchEvent) => {
    if (!detailDragging) return
    if (e.touches.length > 1) return

    const dx = e.touches[0].clientX - detailStartPos.current.x
    const dy = e.touches[0].clientY - detailStartPos.current.y

    if (!detailAxis) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        setDetailAxis(Math.abs(dx) > Math.abs(dy) ? 'x' : 'y')
      }
    }

    if (detailAxis === 'x') {
      setDetailDeltaX(dx)
    }
  }

  const onDetailTouchEnd = () => {
    if (!detailDragging) return
    const dx = detailDeltaX
    resetDetailDrag()

    if (detailAxis === 'x' && Math.abs(dx) > 110) {
      openStakingModal(dx > 0 ? 'yes' : 'no')
    }
  }

  // main deck swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (showStakingModal || showDetail) return
    if (e.touches.length > 1) return
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setDragging(true)
    setAxis(null)
    setDeltaX(0)
    setDeltaY(0)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return
    if (e.touches.length > 1) return
    e.preventDefault()

    const dx = e.touches[0].clientX - startPos.current.x
    const dy = e.touches[0].clientY - startPos.current.y

    if (!axis) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        setAxis(Math.abs(dx) > Math.abs(dy) ? 'x' : 'y')
      }
    }

    if (axis === 'x') {
      setDeltaX(dx)
      setDeltaY(0)
    } else if (axis === 'y') {
      setDeltaY(dy)
      setDeltaX(0)
    }
  }

  const onTouchEnd = () => {
    if (!dragging) return
    const dx = deltaX
    const dy = deltaY
    resetDrag()

    const marketEnded = currentCard && getMarketLifecycleStatus(currentCard.status, currentCard.ends_at) !== 'live'

    if (axis === 'y' && Math.abs(dy) > 110) {
      setCurrentIndex(i => {
        const nextIndex = dy < 0 ? Math.min(i + 1, polls.length - 1) : Math.max(i - 1, 0)
        if (nextIndex !== i) haptics.impact('medium')
        return nextIndex
      })
      return
    }

    // only allow horizontal swipe if market is active
    if (axis === 'x' && Math.abs(dx) > 110 && !marketEnded) {
      openStakingModal(dx > 0 ? 'yes' : 'no')
      return
    }
  }

  const handleConfirmVote = async (amount: number) => {
    if (!stakingDirection || !currentCard || !userId) {
      setVoteError('Could not prepare your vote. Please try again.')
      return
    }

    try {
      setVoteError(null)

      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          poll_id: currentCard.id,
          direction: stakingDirection,
          amount: amount,
          mode: stakingMode,
          device: deviceFingerprint,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || 'vote failed')
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      await Promise.all([
        refetch(),
        onPollsChange?.(),
      ])
      if (typeof responseData.balance === 'number') {
        updateBalance(responseData.balance)
        onBalanceChange?.(responseData.balance)
      }
      haptics.notification('success')
      setShowStakingModal(false)
      setStakingDirection(null)
      setStakingMode('new')
    } catch (error) {
      haptics.notification('error')
      console.error('vote error:', error)
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
      setVoteError(errorMessage || 'Vote failed. Please try again.')
    }
  }

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">no polls</p>
      </div>
    )
  }

  const totalPool = currentCard.yes_pool + currentCard.no_pool
  const yesPercent = totalPool > 0 ? Math.round((currentCard.yes_pool / totalPool) * 100) : 50
  const noPercent = 100 - yesPercent
  const lifecycleStatus = getMarketLifecycleStatus(currentCard.status, currentCard.ends_at)
  const marketEnded = lifecycleStatus !== 'live'
  const toastMessage = voteError || shareFeedback
  const toastType = voteError ? 'error' : 'success'

  // show detail page when arrow is clicked
  if (showDetail) {
    const detailCardTilt = detailAxis === 'x'
      ? `translateX(${detailDeltaX}px) rotate(${detailDeltaX / 18}deg)`
      : 'translateX(0px)'

    // if market ended and user voted, show MarketEnded
    if (marketEnded && userVote) {
      return (
        <>
          <MarketEnded
            pollId={currentCard.id}
            question={currentCard.question}
            userVoteDirection={userVote.direction as 'yes' | 'no'}
            userVoteAmount={userVote.amount}
            claimedAt={userVote.claimed_at}
            payoutAmount={userVote.payout_amount}
            yesPool={currentCard.yes_pool}
            noPool={currentCard.no_pool}
            yesVotes={currentCard.yes_votes}
            noVotes={currentCard.no_votes}
            onBack={() => updateShowDetail(false)}
            onShare={() => shareMarket({ pollId: currentCard.id, question: currentCard.question })}
            onClaimed={async balance => {
              onBalanceChange?.(balance)
              await Promise.all([
                refetch(),
                onPollsChange?.(),
              ])
            }}
          />
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => {
              setVoteError(null)
              clearShareFeedback()
            }}
          />
        </>
      )
    }

    // if already voted on active market, show results page
    if (userVote) {
      const voteDir: 'YES' | 'NO' = userVote.direction === 'yes' ? 'YES' : 'NO'
      return (
        <>
          <ResultsPage
            pollId={currentCard.id}
            question={currentCard.question}
            voteDirection={voteDir}
            amount={userVote.amount}
            yesPercent={yesPercent}
            noPercent={noPercent}
            yesPool={currentCard.yes_pool}
            noPool={currentCard.no_pool}
            yesVotes={currentCard.yes_votes}
            noVotes={currentCard.no_votes}
            claimedAt={userVote.claimed_at}
            payoutAmount={userVote.payout_amount}
            endsAt={currentCard.ends_at}
            marketEnded={marketEnded}
            onBack={() => updateShowDetail(false)}
            onShare={() => shareMarket({ pollId: currentCard.id, question: currentCard.question })}
            onAddMore={() => {
              if (!marketEnded) {
                openStakingModal(userVote.direction === 'yes' ? 'yes' : 'no', 'add')
              }
            }}
            onChangeVote={() => {
              if (!marketEnded) {
                openStakingModal(userVote.direction === 'yes' ? 'no' : 'yes', 'change')
              }
            }}
          />
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => {
              setVoteError(null)
              clearShareFeedback()
            }}
          />
          {showStakingModal && stakingDirection && typeof document !== 'undefined' &&
            createPortal(
              <StakingModal
                question={currentCard.question}
                voteDirection={stakingDirection === 'yes' ? 'YES' : 'NO'}
                availableBalance={availableBalance}
                replacementCredit={userVote && stakingDirection !== userVote.direction ? Number(userVote.amount || 0) : 0}
                onConfirm={handleConfirmVote}
                onCancel={() => {
                  setShowStakingModal(false)
                  setStakingDirection(null)
                  setStakingMode('new')
                }}
              />,
              document.body
            )}
        </>
      )
    }

    // if market ended and user didn't vote, show locked results
    if (marketEnded) {
      return (
        <div className="h-full w-full bg-slate-950 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
            <button
              onClick={() => updateShowDetail(false)}
              className="text-slate-400 text-lg"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => shareMarket({ pollId: currentCard.id, question: currentCard.question })}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition active:scale-95 active:text-cyan-300"
                title="Share market"
              >
                <Share2 size={17} />
              </button>
              <div className="bg-red-900 text-red-400 px-3 py-1 rounded text-sm font-mono">
                ENDED
              </div>
            </div>
          </div>
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => {
              setVoteError(null)
              clearShareFeedback()
            }}
          />

          <div className="flex-1 overflow-y-auto px-5 pb-24">
            <p className="text-white font-bold text-2xl leading-tight mb-6">{currentCard.question}</p>

            <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="text-2xl">🔒</div>
              <div>
                <p className="text-white font-bold">Market Ended</p>
                <p className="text-slate-400 text-sm">You did not participate in this market</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-slate-400 text-xs mb-2">POOL HISTORY</p>
              <PoolHistoryChart pollId={currentCard.id} yesPool={currentCard.yes_pool} noPool={currentCard.no_pool} />
            </div>

            <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="text-2xl">📊</div>
              <div>
                <p className="text-white font-bold">
                  <span className="text-cyan-400">{currentCard.yes_votes} YES</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-pink-500">{currentCard.no_votes} NO</span>
                </p>
                <p className="text-slate-400 text-sm">${(currentCard.yes_pool + currentCard.no_pool).toFixed(2)} USDT total volume</p>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-cyan-400 font-bold text-2xl">${currentCard.yes_pool.toFixed(2)}</p>
                <p className="text-cyan-400 text-xs mt-1">YES Pool</p>
                <p className="text-slate-400 text-xs mt-2">{yesPercent}%</p>
              </div>
              <div className="flex-1 bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-pink-500 font-bold text-2xl">${currentCard.no_pool.toFixed(2)}</p>
                <p className="text-pink-500 text-xs mt-1">NO Pool</p>
                <p className="text-slate-400 text-xs mt-2">{noPercent}%</p>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 mb-6">
              <p className="text-slate-400 text-xs mb-2">FINAL OUTCOME</p>
              <div className="flex items-center gap-3">
                <div className="text-2xl">🏁</div>
                <div>
                  <p className="text-white font-bold">
                    {currentCard.no_votes > currentCard.yes_votes ? 'NO Won' : currentCard.yes_votes > currentCard.no_votes ? 'YES Won' : 'It\'s a Tie'}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {currentCard.no_votes > currentCard.yes_votes ? 'NO' : currentCard.yes_votes > currentCard.no_votes ? 'YES' : 'Both sides'} had more voters
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // active market, user hasn't voted yet
    return (
      <>
        <div className="h-full w-full bg-slate-950 flex flex-col overflow-y-auto">
          <div
            className="mx-4 mt-4 bg-slate-900 rounded-2xl border border-slate-700 flex flex-col p-5"
            onTouchStart={onDetailTouchStart}
            onTouchMove={onDetailTouchMove}
            onTouchEnd={onDetailTouchEnd}
            style={{
              transform: detailCardTilt,
              transition: detailDragging && detailAxis === 'x' ? 'none' : 'transform 200ms ease-out',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => updateShowDetail(false)}
                className="text-slate-400 text-lg"
              >
                ← Back
              </button>
              <Timer endsAt={currentCard.ends_at} onExpire={() => onPollsChange?.()} />
            </div>

            <p className="text-white font-bold text-2xl leading-tight mb-3">{currentCard.question}</p>
            <p className="text-slate-400 text-sm mb-2">Swipe right for YES, left for NO</p>

            <div className="flex items-center justify-between mt-2">
              <p className="text-slate-500 text-xs">← NO · swipe · YES →</p>
              <button
                onClick={() => shareMarket({ pollId: currentCard.id, question: currentCard.question })}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition active:scale-95 active:text-cyan-300"
                title="Share market"
              >
                <Share2 size={18} />
              </button>
            </div>
          </div>
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => {
              setVoteError(null)
              clearShareFeedback()
            }}
          />

          <div className="flex-1 mx-4 mt-4 bg-slate-800 rounded-2xl flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-6xl">🗳️</div>
            <p className="text-white font-bold text-lg">Vote to unlock insights</p>
            <p className="text-slate-400 text-sm text-center">
              Swipe above or tap the buttons below to cast your vote. Charts, odds, and pool data will appear after you vote.
            </p>
          </div>

          <div className="p-4 pb-24">
            <div className="flex gap-3">
              <button
                onClick={() => openStakingModal('no')}
                className="flex-1 bg-pink-500 text-black font-bold py-4 rounded-2xl"
              >
                STAKE NO
              </button>
              <button
                onClick={() => openStakingModal('yes')}
                className="flex-1 bg-cyan-400 text-black font-bold py-4 rounded-2xl"
              >
                STAKE YES
              </button>
            </div>
          </div>
        </div>

        {showStakingModal && stakingDirection && typeof document !== 'undefined' &&
          createPortal(
            <StakingModal
              question={currentCard.question}
              voteDirection={stakingDirection === 'yes' ? 'YES' : 'NO'}
              availableBalance={availableBalance}
              onConfirm={handleConfirmVote}
              onCancel={() => {
                setShowStakingModal(false)
                setStakingDirection(null)
                setStakingMode('new')
              }}
            />,
            document.body
          )}
      </>
    )
  }

  const deckTranslate = axis === 'y'
    ? `translate3d(0, calc(${-currentIndex * 100}% + ${deltaY}px), 0)`
    : `translate3d(0, ${-currentIndex * 100}%, 0)`

  const activeCardTilt = axis === 'x'
    ? `translateX(${deltaX}px) rotate(${deltaX / 18}deg)`
    : 'translateX(0px)'
  const visibleIndicatorCount = Math.min(polls.length, 8)
  const activeIndicatorIndex = polls.length <= 8
    ? currentIndex
    : Math.round((currentIndex / Math.max(1, polls.length - 1)) * (visibleIndicatorCount - 1))

  return (
    <>
      <div
        ref={deckRef}
        className="h-full w-full overflow-hidden touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <div
          className="w-full h-full transition-transform duration-500 ease-out"
          style={{ transform: deckTranslate }}
        >
          {polls.map((poll, i) => {
            const isActive = i === currentIndex
            const pollUserVote = userVotes.find(v => v.poll_id === poll.id)
            const cardStatus = getMarketLifecycleStatus(poll.status, poll.ends_at)
            const statusClass = cardStatus === 'live'
              ? 'bg-cyan-400 text-black'
              : cardStatus === 'paused'
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-slate-800 text-slate-400'
            const cardTotalPool = poll.yes_pool + poll.no_pool
            const cardYesPercent = cardTotalPool > 0 ? Math.round((poll.yes_pool / cardTotalPool) * 100) : 50
            const cardNoPercent = 100 - cardYesPercent

            return (
              <div key={poll.id} className="h-full w-full flex flex-col px-3 pt-1 pb-20">
                <div
                  className="relative flex-1 bg-slate-900 rounded-2xl border border-slate-700 flex flex-col overflow-hidden"
                  style={{
                    transform: isActive ? activeCardTilt : 'translateX(0px)',
                    transition: isActive && dragging && axis === 'x' ? 'none' : 'transform 200ms ease-out',
                  }}
                >
                  {isActive && polls.length > 1 && (
                    <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2 rounded-l-full bg-slate-950/70 px-1.5 py-3 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2">
                        {Array.from({ length: visibleIndicatorCount }).map((_, dotIndex) => (
                          <span
                            key={dotIndex}
                            className={`block rounded-full transition-all duration-300 ${
                              dotIndex === activeIndicatorIndex
                                ? 'h-7 w-1.5 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]'
                                : 'h-1.5 w-1.5 bg-slate-600/70'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                      <Timer endsAt={poll.ends_at} onExpire={() => onPollsChange?.()} />
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass}`}>
                        {getMarketLifecycleLabel(cardStatus)}
                      </span>
                    </div>
                    <div className="text-slate-400 text-sm">${(poll.yes_pool + poll.no_pool).toFixed(2)} USDT</div>
                  </div>

                  {isActive && (
                    <Toast
                      message={toastMessage}
                      type={toastType}
                      onClose={() => {
                        setVoteError(null)
                        clearShareFeedback()
                      }}
                    />
                  )}

                  <div className="px-5 pt-1 pb-2">
                    <p className="text-white font-bold text-3xl leading-tight text-left">{poll.question}</p>
                  </div>

                  {pollUserVote ? (
                    <>
                      <div className="px-5 mb-2">
                        <p className={`text-sm font-bold ${pollUserVote.direction === 'yes' ? 'text-cyan-400' : 'text-pink-500'}`}>
                          You voted {pollUserVote.direction === 'yes' ? 'YES' : 'NO'}
                        </p>
                      </div>

                      <div className="flex-1 mx-4 mb-3 bg-slate-800 rounded-xl overflow-hidden">
                        <PoolHistoryChart pollId={poll.id} yesPool={poll.yes_pool} noPool={poll.no_pool} />
                      </div>

                      <div className="px-5 -mt-1 pb-2 flex justify-between text-lg font-bold">
                        <div className="text-center">
                          <p className="text-cyan-400">{cardYesPercent}%</p>
                          <p className="text-cyan-400 text-xs">YES</p>
                        </div>
                        <div className="text-center">
                          <p className="text-pink-500">{cardNoPercent}%</p>
                          <p className="text-pink-500 text-xs">NO</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 mx-4 mb-3 bg-slate-800 rounded-xl flex flex-col items-center justify-center gap-4">
                      <div className="text-7xl">🗳️</div>
                      <p className="text-white font-semibold text-base">Vote to see results</p>
                      <p className="text-slate-400 text-sm">Swipe right for YES, left for NO</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-5 py-3">
                    <p className="text-slate-500 text-xs">← NO · swipe · YES →</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => shareMarket({ pollId: poll.id, question: poll.question })}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition active:scale-95 active:text-cyan-300"
                        title="Share market"
                      >
                        <Share2 size={17} />
                      </button>
                      <button
                        onClick={() => updateShowDetail(true)}
                        className="bg-cyan-400 text-black rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-center py-2 text-slate-600 text-xs">
                  1% fee · 24h consensus ·
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showStakingModal && stakingDirection && currentCard &&
        createPortal(
          <StakingModal
            question={currentCard.question}
            voteDirection={stakingDirection === 'yes' ? 'YES' : 'NO'}
            availableBalance={availableBalance}
            replacementCredit={userVote && stakingDirection !== userVote.direction ? Number(userVote.amount || 0) : 0}
            onConfirm={handleConfirmVote}
            onCancel={() => {
              setShowStakingModal(false)
              setStakingDirection(null)
              setStakingMode('new')
            }}
          />,
          document.body
        )}
    </>
  )
}

'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import StakingModal from './StakingModal'
import ResultsPage from './ResultsPage'
import MarketEnded from './MarketEnded'
import PoolHistoryChart from './PoolHistoryChart'
import Timer from './Timer'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { usePolls } from '@/app/hooks/usePolls'

type Poll = {
  id: string
  question: string
  yes_votes: number
  no_votes: number
  yes_pool: number
  no_pool: number
  ends_at: string
}

type PollCardProps = {
  polls: Poll[]
  onDetailChange?: (showDetail: boolean) => void
}

export default function PollCard({ polls, onDetailChange }: PollCardProps) {
  const haptics = useHapticFeedback()
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentCard = polls && polls.length > 0 ? polls[currentIndex] : null

  const { userId, initData } = useTelegramUser()
  const { userVotes } = usePolls(userId)

  const userVote = currentCard ? userVotes.find(v => v.poll_id === currentCard.id) : null

  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'yes' | 'no' | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const updateShowDetail = (nextShowDetail: boolean) => {
    if (nextShowDetail) haptics.impact('light')
    else haptics.selection()
    setShowDetail(nextShowDetail)
    onDetailChange?.(nextShowDetail)
  }

  const openStakingModal = (direction: 'yes' | 'no') => {
    haptics.impact('medium')
    setStakingDirection(direction)
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

    const marketEnded = currentCard && new Date(currentCard.ends_at) < new Date()

    if (axis === 'y' && Math.abs(dy) > 110) {
      setCurrentIndex(i => {
        const nextIndex = dy < 0 ? Math.min(i + 1, polls.length - 1) : Math.max(i - 1, 0)
        if (nextIndex !== i) haptics.selection()
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
      alert(`missing data: userId=${userId}, direction=${stakingDirection}, card=${currentCard?.id}`)
      return
    }

    try {
      console.log('sending vote:', { userId, poll_id: currentCard.id, direction: stakingDirection, amount })

      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          poll_id: currentCard.id,
          direction: stakingDirection,
          amount: amount,
        }),
      })

      const responseData = await response.json()
      console.log('vote response:', responseData)

      if (!response.ok) {
        throw new Error(responseData.error || 'vote failed')
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      haptics.notification('success')
      setShowStakingModal(false)
      setStakingDirection(null)
    } catch (error) {
      haptics.notification('error')
      console.error('vote error:', error)
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
      alert(`vote failed: ${errorMessage}`)
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
  const marketEnded = new Date(currentCard.ends_at) < new Date()

  // show detail page when arrow is clicked
  if (showDetail) {
    const detailCardTilt = detailAxis === 'x'
      ? `translateX(${detailDeltaX}px) rotate(${detailDeltaX / 18}deg)`
      : 'translateX(0px)'

    // if market ended and user voted, show MarketEnded
    if (marketEnded && userVote) {
      return (
        <MarketEnded
          pollId={currentCard.id}
          question={currentCard.question}
          userVoteDirection={userVote.direction as 'yes' | 'no'}
          yesPool={currentCard.yes_pool}
          noPool={currentCard.no_pool}
          yesVotes={currentCard.yes_votes}
          noVotes={currentCard.no_votes}
          onBack={() => updateShowDetail(false)}
        />
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
            marketEnded={marketEnded}
            onBack={() => updateShowDetail(false)}
            onAddMore={() => {
              if (!marketEnded) {
                openStakingModal(userVote.direction === 'yes' ? 'yes' : 'no')
              }
            }}
            onChangeVote={() => {
              if (!marketEnded) {
                openStakingModal(userVote.direction === 'yes' ? 'no' : 'yes')
              }
            }}
          />
          {showStakingModal && stakingDirection && typeof document !== 'undefined' &&
            createPortal(
              <StakingModal
                question={currentCard.question}
                voteDirection={stakingDirection === 'yes' ? 'YES' : 'NO'}
                onConfirm={handleConfirmVote}
                onCancel={() => {
                  setShowStakingModal(false)
                  setStakingDirection(null)
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
            <div className="bg-red-900 text-red-400 px-3 py-1 rounded text-sm font-mono">
              ENDED
            </div>
          </div>

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
              <PoolHistoryChart pollId={currentCard.id} />
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
              <Timer endsAt={currentCard.ends_at} />
            </div>

            <p className="text-white font-bold text-2xl leading-tight mb-3">{currentCard.question}</p>
            <p className="text-slate-400 text-sm mb-2">Swipe right for YES, left for NO</p>

            <div className="flex items-center justify-between mt-2">
              <p className="text-slate-500 text-xs">← NO · swipe · YES →</p>
              <button className="text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>

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
              onConfirm={handleConfirmVote}
              onCancel={() => {
                setShowStakingModal(false)
                setStakingDirection(null)
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

            return (
              <div key={poll.id} className="h-full w-full flex flex-col px-4 pt-2 pb-24">
                <div
                  className="flex-1 bg-slate-900 rounded-2xl border border-slate-700 flex flex-col overflow-hidden"
                  style={{
                    transform: isActive ? activeCardTilt : 'translateX(0px)',
                    transition: isActive && dragging && axis === 'x' ? 'none' : 'transform 200ms ease-out',
                  }}
                >
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <Timer endsAt={poll.ends_at} />
                    <div className="text-slate-400 text-sm">${(poll.yes_pool + poll.no_pool).toFixed(2)} USDT</div>
                  </div>

                  <div className="px-5 pt-2 pb-3">
                    <p className="text-white font-bold text-3xl leading-tight text-left">{poll.question}</p>
                  </div>

                  {pollUserVote ? (
                    <>
                      <div className="px-5 mb-2">
                        <p className={`text-sm font-bold ${pollUserVote.direction === 'yes' ? 'text-cyan-400' : 'text-pink-500'}`}>
                          You voted {pollUserVote.direction === 'yes' ? 'YES' : 'NO'}
                        </p>
                      </div>

                      <div className="flex-1 mx-4 mb-4 bg-slate-800 rounded-xl overflow-hidden">
                        <PoolHistoryChart pollId={poll.id} />
                      </div>

                      <div className="px-5 pb-3 flex justify-between text-lg font-bold">
                        <div className="text-center">
                          <p className="text-cyan-400">{Math.round((poll.yes_pool / (poll.yes_pool + poll.no_pool)) * 100)}%</p>
                          <p className="text-cyan-400 text-xs">YES</p>
                        </div>
                        <div className="text-center">
                          <p className="text-pink-500">{Math.round((poll.no_pool / (poll.yes_pool + poll.no_pool)) * 100)}%</p>
                          <p className="text-pink-500 text-xs">NO</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 mx-4 mb-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center gap-4">
                      <div className="text-7xl">🗳️</div>
                      <p className="text-white font-semibold text-base">Vote to see results</p>
                      <p className="text-slate-400 text-sm">Swipe right for YES, left for NO</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-5 py-4">
                    <p className="text-slate-500 text-xs">← NO · swipe · YES →</p>
                    <button
                      onClick={() => updateShowDetail(true)}
                      className="bg-cyan-400 text-black rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="text-center py-3 text-slate-600 text-xs">
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
            onConfirm={handleConfirmVote}
            onCancel={() => {
              setShowStakingModal(false)
              setStakingDirection(null)
            }}
          />,
          document.body
        )}
    </>
  )
}

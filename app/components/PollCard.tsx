'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import StakingModal from './StakingModal'
import ResultsPage from './ResultsPage'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'

type Vote = { pollId: string; vote: 'yes' | 'no'; amount: number }
type Poll = {
  id: string
  question: string
  yes_votes: number
  no_votes: number
  yes_pool: number
  no_pool: number
  ends_at: string
}

export default function PollCard({ polls }: { polls: Poll[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentCard = polls && polls.length > 0 ? polls[currentIndex] : null

  const { userId } = useTelegramUser()

  const [votes, setVotes] = useState<Vote[]>([])
  const userVote = currentCard ? votes.find(v => v.pollId === currentCard.id) : null

  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'yes' | 'no' | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

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
      setStakingDirection(dx > 0 ? 'yes' : 'no')
      setShowStakingModal(true)
    }
  }

  // main deck swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (showStakingModal || showResults || showDetail) return
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

    if (axis === 'y' && Math.abs(dy) > 110) {
      if (dy < 0) setCurrentIndex(i => Math.min(i + 1, polls.length - 1))
      else setCurrentIndex(i => Math.max(i - 1, 0))
      return
    }

    if (axis === 'x' && Math.abs(dx) > 110) {
      setStakingDirection(dx > 0 ? 'yes' : 'no')
      setShowStakingModal(true)
      return
    }
  }

  const handleConfirmVote = async (amount: number) => {
    if (!stakingDirection || !currentCard || !userId) return

    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          poll_id: currentCard.id,
          direction: stakingDirection,
          amount: amount,
        }),
      })

      if (!response.ok) throw new Error('vote failed')

      const updated: Vote = { pollId: currentCard.id, vote: stakingDirection, amount }
      setVotes(prev => {
        const idx = prev.findIndex(v => v.pollId === currentCard.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
      setShowResults(true)
      setShowDetail(false)
      setShowStakingModal(false)
      setStakingDirection(null)
    } catch (error) {
      console.error('vote error:', error)
      alert('vote failed. try again.')
    }
  }

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">no polls</p>
      </div>
    )
  }

  const totalVotes = currentCard.yes_votes + currentCard.no_votes
  const yesPercent = totalVotes > 0 ? Math.round((currentCard.yes_votes / totalVotes) * 100) : 50
  const noPercent = 100 - yesPercent
  const marketEnded = new Date(currentCard.ends_at) < new Date()

  // show results page after voting
  if (showResults && userVote) {
    const voteDir: 'YES' | 'NO' = userVote.vote === 'yes' ? 'YES' : 'NO'
    return (
      <>
        <ResultsPage
          question={currentCard.question}
          voteDirection={voteDir}
          amount={userVote.amount}
          yesPercent={yesPercent}
          noPercent={noPercent}
          yesPool={currentCard.yes_pool + (userVote.vote === 'yes' ? userVote.amount : 0)}
          noPool={currentCard.no_pool + (userVote.vote === 'no' ? userVote.amount : 0)}
          marketEnded={marketEnded}
          onBack={() => {
            setShowResults(false)
            setCurrentIndex(i => Math.min(i + 1, polls.length - 1))
          }}
          onAddMore={() => {
            setShowResults(false)
            setStakingDirection(userVote.vote)
            setShowStakingModal(true)
          }}
          onChangeVote={() => {
            setShowResults(false)
            setStakingDirection(userVote.vote === 'yes' ? 'no' : 'yes')
            setShowStakingModal(true)
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

  // show detail page when arrow is clicked
  if (showDetail) {
    const detailCardTilt = detailAxis === 'x'
      ? `translateX(${detailDeltaX}px) rotate(${detailDeltaX / 18}deg)`
      : 'translateX(0px)'

    // if already voted, show results directly
    if (userVote) {
      const voteDir: 'YES' | 'NO' = userVote.vote === 'yes' ? 'YES' : 'NO'
      return (
        <>
          <ResultsPage
            question={currentCard.question}
            voteDirection={voteDir}
            amount={userVote.amount}
            yesPercent={yesPercent}
            noPercent={noPercent}
            yesPool={currentCard.yes_pool + (userVote.vote === 'yes' ? userVote.amount : 0)}
            noPool={currentCard.no_pool + (userVote.vote === 'no' ? userVote.amount : 0)}
            marketEnded={marketEnded}
            onBack={() => setShowDetail(false)}
            onAddMore={() => {
              setStakingDirection(userVote.vote)
              setShowStakingModal(true)
            }}
            onChangeVote={() => {
              setStakingDirection(userVote.vote === 'yes' ? 'no' : 'yes')
              setShowStakingModal(true)
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

    return (
      <>
        <div className="h-full w-full bg-slate-950 flex flex-col overflow-hidden">
          {/* swipeable question card */}
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
                onClick={() => setShowDetail(false)}
                className="text-slate-400 text-lg"
              >
                ← Back
              </button>
              <div className="bg-cyan-900 text-cyan-400 px-3 py-1 rounded text-sm font-mono">
                00:46:49
              </div>
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

          {/* vote to unlock box */}
          <div className="flex-1 mx-4 mt-4 bg-slate-800 rounded-2xl flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-6xl">🗳️</div>
            <p className="text-white font-bold text-lg">Vote to unlock insights</p>
            <p className="text-slate-400 text-sm text-center">
              Swipe above or tap the buttons below to cast your vote. Charts, odds, and pool data will appear after you vote.
            </p>
          </div>

          {/* stake buttons */}
          <div className="p-4 pb-8">
            <div className="flex gap-3">
              <button
                onClick={() => { setStakingDirection('no'); setShowStakingModal(true) }}
                className="flex-1 bg-pink-500 text-black font-bold py-4 rounded-2xl"
              >
                STAKE NO
              </button>
              <button
                onClick={() => { setStakingDirection('yes'); setShowStakingModal(true) }}
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

            return (
              <div key={poll.id} className="h-full w-full flex flex-col px-4 pt-4 pb-60">
                <div
                  className="flex-1 bg-slate-900 rounded-2xl border border-slate-700 flex flex-col overflow-hidden"
                  style={{
                    transform: isActive ? activeCardTilt : 'translateX(0px)',
                    transition: isActive && dragging && axis === 'x' ? 'none' : 'transform 200ms ease-out',
                  }}
                >
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div className="bg-cyan-900 text-cyan-400 px-3 py-1 rounded text-sm font-mono">00:46:49</div>
                    <div className="text-slate-400 text-sm">${(poll.yes_pool + poll.no_pool).toFixed(2)} USDT</div>
                  </div>

                  <div className="px-5 pt-2 pb-6">
                    <p className="text-white font-bold text-3xl leading-tight text-left">{poll.question}</p>
                  </div>

                  <div className="flex-1 mx-4 mb-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center gap-4">
                    <div className="text-7xl">🗳️</div>
                    <p className="text-white font-semibold text-base">Vote to see results</p>
                    <p className="text-slate-400 text-sm">Swipe right for YES, left for NO</p>
                  </div>

                  {/* bottom row with swipe hint and arrow button */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <p className="text-slate-500 text-xs">← NO · swipe · YES →</p>
                    <button
                      onClick={() => setShowDetail(true)}
                      className="bg-cyan-400 text-black rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="text-center py-3 text-slate-600 text-xs">
                  1% fee · 24h consensus · no gas
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
'use client'

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import StakingModal from './StakingModal'
import ResultsPage from './ResultsPage'

type Vote = { cardId: number; vote: 'YES' | 'NO'; amount: number }

export default function PollCard() {
  const cards = useMemo(
    () => [
      { id: 1, question: 'Is crypto the future of money?', yesPercent: 65, noPercent: 35 },
      { id: 2, question: 'Should couples split everything 50/50?', yesPercent: 58, noPercent: 42 },
      { id: 3, question: 'Is trash talking necessary in sports?', yesPercent: 72, noPercent: 28 },
    ],
    []
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const currentCard = cards[currentIndex]

  const [votes, setVotes] = useState<Vote[]>([])
  const userVote = votes.find(v => v.cardId === currentCard.id)

  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'YES' | 'NO' | null>(null)
  const [showResults, setShowResults] = useState(false)

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

  const onTouchStart = (e: React.TouchEvent) => {
    if (showStakingModal || showResults) return
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
      if (dy < 0) setCurrentIndex(i => Math.min(i + 1, cards.length - 1))
      else setCurrentIndex(i => Math.max(i - 1, 0))
      return
    }

    if (axis === 'x' && Math.abs(dx) > 110) {
      setStakingDirection(dx > 0 ? 'YES' : 'NO')
      setShowStakingModal(true)
      return
    }
  }

  const handleConfirmVote = (amount: number) => {
    if (!stakingDirection) return
    const updated: Vote = { cardId: currentCard.id, vote: stakingDirection, amount }
    setVotes(prev => {
      const idx = prev.findIndex(v => v.cardId === currentCard.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [...prev, updated]
    })
    setShowResults(true)
    setShowStakingModal(false)
    setStakingDirection(null)
  }

  if (showResults && userVote) {
    return (
      <ResultsPage
        question={currentCard.question}
        voteDirection={userVote.vote}
        amount={userVote.amount}
        yesPercent={currentCard.yesPercent}
        noPercent={currentCard.noPercent}
        onBack={() => {
          setShowResults(false)
          setCurrentIndex(i => Math.min(i + 1, cards.length - 1))
        }}
        onAddMore={() => {
          setShowResults(false)
          setStakingDirection(userVote.vote)
          setShowStakingModal(true)
        }}
        onChangeVote={() => {
          setShowResults(false)
          setStakingDirection(userVote.vote === 'YES' ? 'NO' : 'YES')
          setShowStakingModal(true)
        }}
      />
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
        className="h-screen w-full overflow-hidden touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <div
          className="w-full h-full transition-transform duration-500 ease-out"
          style={{ transform: deckTranslate }}
        >
          {cards.map((c, i) => {
            const isActive = i === currentIndex

            return (
              <div key={c.id} className="h-screen w-full flex flex-col px-4 pt-4 pb-60">
                {/* card fills the screen */}
                <div
                  className="flex-1 bg-slate-900 rounded-2xl border border-slate-700 flex flex-col overflow-hidden"
                  style={{
                    transform: isActive ? activeCardTilt : 'translateX(0px)',
                    transition: isActive && dragging && axis === 'x' ? 'none' : 'transform 200ms ease-out',
                  }}
                >
                  {/* top row inside card */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div className="bg-cyan-900 text-cyan-400 px-3 py-1 rounded text-sm font-mono">00:46:49</div>
                    <div className="text-slate-400 text-sm">${100 + i * 50} USDC</div>
                  </div>

                  {/* question - left aligned, large */}
                  <div className="px-5 pt-2 pb-6">
                    <p className="text-white font-bold text-3xl leading-tight text-left">{c.question}</p>
                  </div>

                  {/* voting area - fills remaining space */}
                  <div className="flex-1 mx-4 mb-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center gap-4">
                    <div className="text-7xl">🗳️</div>
                    <p className="text-white font-semibold text-base">Vote to see results</p>
                    <p className="text-slate-400 text-sm">Swipe right for YES, left for NO</p>
                  </div>

                  {/* bottom row inside card */}
                  <div className="text-center py-4 text-slate-500 text-xs">
                    ← NO · swipe · YES →
                  </div>
                </div>

                {/* below card */}
                <div className="text-center py-3 text-slate-600 text-xs">
                  1% fee · 24h consensus · no gas
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showStakingModal && stakingDirection &&
        createPortal(
          <StakingModal
            question={currentCard.question}
            voteDirection={stakingDirection}
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
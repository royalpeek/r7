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

  // swipe anim (horizontal)
  const startPos = useRef({ x: 0, y: 0 })
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const lockDirectionFromDrag = (dx: number, dy: number) => {
    if (Math.abs(dx) > Math.abs(dy)) return 'x'
    return 'y'
  }

  const resetDrag = () => {
    setDragX(0)
    setDragY(0)
    setDragging(false)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (showStakingModal || showResults) return
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setDragging(true)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return
    if (e.touches.length > 1) return
    e.preventDefault()

    const dx = e.touches[0].clientX - startPos.current.x
    const dy = e.touches[0].clientY - startPos.current.y

    // only keep one axis for clearer gestures
    const axis = lockDirectionFromDrag(dx, dy)
    if (axis === 'x') {
      setDragX(dx)
      setDragY(0)
    } else {
      setDragY(dy)
      setDragX(0)
    }
  }

  const onTouchEnd = () => {
    if (!dragging) return

    const dx = dragX
    const dy = dragY
    const thresholdX = 110
    const thresholdY = 110

    // reset first so modal open doesn't feel “dragged”
    resetDrag()

    // vertical: next/prev poll (no wrap by default)
    if (Math.abs(dy) > thresholdY && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) setCurrentIndex(i => Math.min(i + 1, cards.length - 1))
      else setCurrentIndex(i => Math.max(i - 1, 0))
      return
    }

    // horizontal: vote
    if (Math.abs(dx) > thresholdX && Math.abs(dx) > Math.abs(dy)) {
      const dir: 'YES' | 'NO' = dx > 0 ? 'YES' : 'NO'
      setStakingDirection(dir)
      setShowStakingModal(true)
      return
    }
  }

  const handleConfirmVote = (amount: number) => {
    if (!stakingDirection) return

    const updated: Vote = {
      cardId: currentCard.id,
      vote: stakingDirection,
      amount,
    }

    setVotes(prev => {
      const idx = prev.findIndex(v => v.cardId === currentCard.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [...prev, updated]
    })

    setShowStakingModal(false)
    setShowResults(true)
  }

  return (
    <>
      {/* deck container: keep it centered, no extra padding that pushes down */}
      <div className="h-screen w-full overflow-hidden bg-slate-950 flex items-stretch justify-center">
        {/* touch layer */}
        <div
          className="w-full h-full touch-none overscroll-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: 'none' }}
        >
          {/* vertical deck movement */}
          <div
            className="h-full w-full transition-transform duration-500 ease-out"
            style={{
              transform: `translate3d(0, ${-currentIndex * 100}%, 0)`,
            }}
          >
            {cards.map((c, i) => {
              const isActive = i === currentIndex
              const voteTilt = isActive ? `translateX(${dragX}px) rotate(${dragX / 18}deg)` : 'translateX(0px)'

              return (
                <div key={c.id} className="h-screen w-full flex items-center justify-center px-4">
                  <div
                    className="w-full max-w-xl bg-slate-800 rounded-xl p-6 border border-slate-700"
                  >
                    {/* header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="bg-cyan-900 text-cyan-400 px-3 py-1 rounded text-sm font-mono">
                        00:46:49
                      </div>
                      <div className="text-slate-400 text-sm">${100 + i * 50} USDC</div>
                    </div>

                    {/* main card */}
                    <div
                      className="bg-slate-900 rounded-lg border border-slate-700 min-h-[520px] flex items-center justify-center"
                      style={{
                        transform: voteTilt,
                        transition: isActive && dragging ? 'none' : 'transform 200ms ease-out',
                      }}
                    >
                      <div className="text-center w-full px-4">
                        <p className="text-white font-bold text-3xl mb-10 leading-tight">{c.question}</p>

                        <div className="space-y-4">
                          <div className="w-44 h-44 mx-auto bg-slate-800 rounded-lg flex items-center justify-center">
                            <div className="text-6xl">🗳️</div>
                          </div>

                          <p className="text-slate-400 text-sm">swipe to vote</p>
                          <p className="text-slate-500 text-xs">swipe right for yes, left for no</p>

                          <p className="text-slate-500 text-xs mt-3">swipe up/down for next poll</p>
                        </div>
                      </div>
                    </div>

                    {/* footer note inside the card so it never goes “down too much” */}
                    <div className="text-center mt-6 text-slate-500 text-xs">
                      0.5% fee · 24h consensus · no gas
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showStakingModal && stakingDirection && createPortal(
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
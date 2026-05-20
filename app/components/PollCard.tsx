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

  // swipe anim
  const startPos = useRef({ x: 0, y: 0 })
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const resetDrag = () => {
    setDragX(0)
    setDragY(0)
    setDragging(false)
  }

  const axisFromDrag = (dx: number, dy: number) => (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y')

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
    const axis = axisFromDrag(dx, dy)

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

    resetDrag()

    if (Math.abs(dy) > thresholdY && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) setCurrentIndex(i => Math.min(i + 1, cards.length - 1))
      else setCurrentIndex(i => Math.max(i - 1, 0))
      return
    }

    if (Math.abs(dx) > thresholdX && Math.abs(dx) > Math.abs(dy)) {
      setStakingDirection(dx > 0 ? 'YES' : 'NO')
      setShowStakingModal(true)
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

    // important: switch to results, then hide modal
    setShowResults(true)
    setShowStakingModal(false)
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

  return (
    <>
      {/* render deck only when modal is not open (prevents race/jank) */}
      {!showStakingModal && (
        <div className="h-screen w-full overflow-hidden bg-slate-950 flex items-stretch justify-center">
          <div
            className="w-full h-full touch-none overscroll-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ touchAction: 'none' }}
          >
            <div
              className="h-full w-full transition-transform duration-500 ease-out"
              style={{ transform: `translate3d(0, ${-currentIndex * 100}%, 0)` }}
            >
              {cards.map((c, i) => {
                const isActive = i === currentIndex
                const tilt = isActive ? `translateX(${dragX}px) rotate(${dragX / 18}deg)` : 'translateX(0px)'
                return (
                  <div key={c.id} className="h-screen w-full flex items-center justify-center px-4">
                    <div className="w-full max-w-xl bg-slate-800 rounded-xl p-6 border border-slate-700">
                      <div className="flex items-center justify-between mb-6">
                        <div className="bg-cyan-900 text-cyan-400 px-3 py-1 rounded text-sm font-mono">
                          00:46:49
                        </div>
                        <div className="text-slate-400 text-sm">${100 + i * 50} USDC</div>
                      </div>

                      <div className="bg-slate-900 rounded-lg border border-slate-700 min-h-[520px] flex items-center justify-center">
                        <div
                          className="text-center w-full px-4"
                          style={{
                            transform: tilt,
                            transition: isActive && dragging ? 'none' : 'transform 200ms ease-out',
                          }}
                        >
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
      )}

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
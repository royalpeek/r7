'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import StakingModal from './StakingModal'
import ResultsPage from './ResultsPage'

export default function PollCard() {
  const [cards] = useState([
    { id: 1, question: 'Is crypto the future of money?', yesPercent: 65, noPercent: 35 },
    { id: 2, question: 'Should couples split everything 50/50?', yesPercent: 58, noPercent: 42 },
    { id: 3, question: 'Is trash talking necessary in sports?', yesPercent: 72, noPercent: 28 },
  ])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'YES' | 'NO' | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [votes, setVotes] = useState<{ cardId: number; vote: 'YES' | 'NO'; amount: number }[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(0)

  // handle vertical swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current
    setOffset(diff)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (offset < -100 && currentIndex < cards.length - 1) setCurrentIndex(prev => prev + 1)
    else if (offset > 100 && currentIndex > 0) setCurrentIndex(prev => prev - 1)
    setOffset(0)
  }

  return (
    <div className="h-screen w-full overflow-hidden relative bg-slate-950">
      <div
        ref={containerRef}
        className="h-full w-full transition-transform duration-500 ease-out flex flex-col"
        style={{ transform: `translateY(calc(${-currentIndex * 100}vh + ${offset}px))` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {cards.map((card, i) => (
          <div key={card.id} className="h-screen w-full flex items-center justify-center p-4 flex-shrink-0">
            <div 
              className="w-full max-w-sm bg-slate-900 p-8 rounded-xl border border-slate-700 shadow-2xl relative"
              // simple horizontal swipe for yes/no
              onTouchStart={(e) => {
                const startX = e.touches[0].clientX
                e.currentTarget.ontouchend = (ev) => {
                  const endX = ev.changedTouches[0].clientX
                  if (startX - endX > 100) { setStakingDirection('NO'); setShowStakingModal(true) }
                  else if (endX - startX > 100) { setStakingDirection('YES'); setShowStakingModal(true) }
                }
              }}
            >
              <p className="text-white font-bold text-2xl mb-4">{card.question}</p>
              <p className="text-slate-500 text-sm">swipe left/right to stake</p>
              <p className="text-slate-500 text-sm">swipe up/down to scroll polls</p>
            </div>
          </div>
        ))}
      </div>

      {showStakingModal && (
        createPortal(
          <StakingModal
            question={cards[currentIndex].question}
            voteDirection={stakingDirection!}
            onConfirm={() => setShowStakingModal(false)}
            onCancel={() => setShowStakingModal(false)}
          />,
          document.body
        )
      )}
    </div>
  )
}
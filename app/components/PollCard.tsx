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

  // swipe state
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startPos = useRef({ x: 0, y: 0 })

  const handleStart = (clientX: number, clientY: number) => {
    startPos.current = { x: clientX, y: clientY }
    setIsDragging(true)
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return
    const dx = clientX - startPos.current.x
    const dy = clientY - startPos.current.y
    // limit horizontal drag for vote, vertical for navigation
    if (Math.abs(dx) > Math.abs(dy)) setDragX(dx)
    else setDragY(dy)
  }

  const handleEnd = () => {
    if (dragX > 100) { setStakingDirection('YES'); setShowStakingModal(true) }
    else if (dragX < -100) { setStakingDirection('NO'); setShowStakingModal(true) }
    else if (dragY < -100 && currentIndex < cards.length - 1) setCurrentIndex(i => i + 1)
    else if (dragY > 100 && currentIndex > 0) setCurrentIndex(i => i - 1)
    
    setDragX(0)
    setDragY(0)
    setIsDragging(false)
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-4">
      <div 
        className="w-full h-full flex flex-col justify-center items-center transition-transform duration-500 ease-out"
        style={{ transform: `translateY(calc(${-currentIndex * 100}vh + ${dragY}px))` }}
      >
        {cards.map((card, i) => (
          <div key={card.id} className="h-screen w-full flex-shrink-0 flex items-center justify-center">
            <div 
              className="w-full max-w-lg bg-slate-900 p-10 rounded-2xl border border-slate-700 shadow-2xl transition-transform duration-300"
              style={{
                transform: i === currentIndex ? `translateX(${dragX}px) rotate(${dragX / 20}deg)` : 'none',
                opacity: i === currentIndex ? 1 - Math.abs(dragX) / 500 : 0.5
              }}
              onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY) }}
              onTouchEnd={handleEnd}
            >
              <p className="text-white font-bold text-4xl mb-12 leading-tight">{card.question}</p>
              <div className="text-slate-400 text-lg">swipe right for YES, left for NO</div>
              <div className="text-slate-400 text-lg">swipe up for next poll</div>
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
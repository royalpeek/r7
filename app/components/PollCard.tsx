'use client'

import { useState, useRef } from 'react'
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
  const [votes, setVotes] = useState<{ cardId: number; vote: 'YES' | 'NO'; amount: number }[]>([])
  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'YES' | 'NO' | null>(null)
  const [showResults, setShowResults] = useState(false)

  // swipe animation state
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const startPos = useRef({ x: 0, y: 0 })

  const handleStart = (clientX: number, clientY: number) => {
    startPos.current = { x: clientX, y: clientY }
  }

  const handleMove = (clientX: number, clientY: number) => {
    const dx = clientX - startPos.current.x
    const dy = clientY - startPos.current.y
    // only update if drag exceeds small threshold
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      setDragX(dx)
      setDragY(dy)
    }
  }

  const handleEnd = () => {
    if (dragX > 100) { setStakingDirection('YES'); setShowStakingModal(true) }
    else if (dragX < -100) { setStakingDirection('NO'); setShowStakingModal(true) }
    else if (dragY < -100 && currentIndex < cards.length - 1) setCurrentIndex(i => i + 1)
    else if (dragY > 100 && currentIndex > 0) setCurrentIndex(i => i - 1)
    
    setDragX(0)
    setDragY(0)
  }

  const confirmVote = (amount: number) => {
    setVotes(prev => [...prev.filter(v => v.cardId !== cards[currentIndex].id), { cardId: cards[currentIndex].id, vote: stakingDirection!, amount }])
    setShowStakingModal(false)
    setShowResults(true)
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-950 flex flex-col pt-10 pb-20">
      <div className="flex-1 relative flex items-center justify-center">
        <div 
          className="w-full h-full flex flex-col transition-transform duration-500 ease-out"
          style={{ transform: `translateY(${-currentIndex * 100}vh)` }}
        >
          {cards.map((card, i) => (
            <div key={card.id} className="h-full w-full flex-shrink-0 flex items-center justify-center p-6">
              <div 
                className="w-full max-w-lg bg-slate-900 p-8 rounded-2xl border border-slate-700 shadow-2xl transition-all duration-200"
                style={{
                  transform: i === currentIndex ? `translateX(${dragX}px) rotate(${dragX / 15}deg)` : 'none',
                  opacity: i === currentIndex ? 1 - Math.abs(dragX) / 400 : 0.5
                }}
                onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY) }}
                onTouchEnd={handleEnd}
              >
                <p className="text-white font-bold text-3xl mb-8 leading-tight">{card.question}</p>
                <div className="text-slate-500 text-lg space-y-2">
                  <p>→ swipe right for YES</p>
                  <p>← swipe left for NO</p>
                  <p>↑ swipe up for NEXT</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {showStakingModal && (
        createPortal(
          <StakingModal
            question={cards[currentIndex].question}
            voteDirection={stakingDirection!}
            onConfirm={confirmVote}
            onCancel={() => setShowStakingModal(false)}
          />,
          document.body
        )
      )}
      
      {showResults && (
        <ResultsPage
          question={cards[currentIndex].question}
          voteDirection={stakingDirection!}
          amount={votes.find(v => v.cardId === cards[currentIndex].id)?.amount || 0}
          yesPercent={cards[currentIndex].yesPercent}
          noPercent={cards[currentIndex].noPercent}
          onBack={() => setShowResults(false)}
          onAddMore={() => setShowStakingModal(true)}
          onChangeVote={() => setShowStakingModal(true)}
        />
      )}
    </div>
  )
}
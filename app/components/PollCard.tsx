'use client'

import { useEffect, useState, useRef } from 'react'
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
  const [transform, setTransform] = useState({ x: 0, y: 0, rotate: 0 })
  const [votes, setVotes] = useState<{ cardId: number; vote: string; amount: number }[]>([])
  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'YES' | 'NO' | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [isSwiping, setIsSwiping] = useState(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const isDragging = useRef(false)

  const currentCard = cards[currentIndex]
  const userVote = votes.find(v => v.cardId === currentCard.id)

  useEffect(() => {
    document.body.style.overflow = isSwiping || showStakingModal ? 'hidden' : ''
    document.documentElement.style.overflow = isSwiping || showStakingModal ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [isSwiping, showStakingModal])

  const handleStart = (clientX: number, clientY: number) => {
    if (showStakingModal || showResults) return
    startX.current = clientX
    startY.current = clientY
    isDragging.current = true
    setIsSwiping(true)
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging.current || showStakingModal || showResults) return
    const diffX = clientX - startX.current
    const diffY = clientY - startY.current
    const rotate = diffX / 25
    setTransform({ x: diffX, y: diffY, rotate })
  }

  const handleEnd = () => {
    if (!isDragging.current) {
      isDragging.current = false
      setIsSwiping(false)
      return
    }

    isDragging.current = false
    setIsSwiping(false)

    const diffX = transform.x
    const diffY = transform.y
    const thresholdX = 80
    const thresholdY = 80

    if (Math.abs(diffY) > thresholdY && Math.abs(diffY) > Math.abs(diffX)) {
      if (diffY < 0) {
        setCurrentIndex((currentIndex + 1) % cards.length)
      } else {
        setCurrentIndex((currentIndex - 1 + cards.length) % cards.length)
      }
      setTransform({ x: 0, y: 0, rotate: 0 })
      return
    }

    if (Math.abs(diffX) > thresholdX) {
      const voteDirection = diffX > 0 ? 'YES' : 'NO'
      setTransform({ x: 0, y: 0, rotate: 0 })

      if (voteDirection === 'YES') {
        requestAnimationFrame(() => {
          setStakingDirection('YES')
          setShowStakingModal(true)
        })
      } else {
        setStakingDirection('NO')
        setShowStakingModal(true)
      }

      return
    }

    setTransform({ x: 0, y: 0, rotate: 0 })
  }

  const handleConfirmStake = (amount: number) => {
    if (!stakingDirection) return

    const updatedVote = {
      cardId: currentCard.id,
      vote: stakingDirection,
      amount,
    }

    setVotes(prev => {
      const existingIndex = prev.findIndex(v => v.cardId === currentCard.id)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = updatedVote
        return next
      }
      return [...prev, updatedVote]
    })

    setShowStakingModal(false)
    setShowResults(true)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return
    handleMove(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    handleMove(e.touches[0].clientX, e.touches[0].clientY)
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  if (showResults && userVote) {
    return (
      <ResultsPage
        question={currentCard.question}
        voteDirection={userVote.vote as 'YES' | 'NO'}
        amount={userVote.amount}
        yesPercent={currentCard.yesPercent}
        noPercent={currentCard.noPercent}
        onBack={() => {
          setShowResults(false)
          setCurrentIndex((currentIndex + 1) % cards.length)
        }}
        onAddMore={() => {
          setShowResults(false)
          setStakingDirection(userVote.vote as 'YES' | 'NO')
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
      <div className="bg-slate-950 min-h-screen p-4 flex items-center justify-center pb-48 overflow-x-hidden overscroll-none">
        <div className="w-full max-w-sm">
          <div className="bg-slate-800 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-cyan-900 text-cyan-400 px-3 py-1 rounded text-sm font-mono">00:46:49</div>
              <div className="text-slate-400 text-sm">${100 + currentIndex * 50} USDC</div>
            </div>

            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="bg-slate-900 p-8 rounded-lg border border-slate-700 cursor-grab active:cursor-grabbing min-h-96 flex flex-col items-center justify-center select-none touch-none will-change-transform"
              style={{
                touchAction: 'none',
                transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${transform.rotate}deg)`,
                transition: transform.x === 0 && transform.y === 0 ? 'transform 0.25s ease-out' : 'none',
              }}
            >
              <div className="text-center w-full">
                <p className="text-white font-bold text-2xl mb-12">{currentCard.question}</p>
                <div className="space-y-4">
                  <div className="w-40 h-40 mx-auto bg-slate-800 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-5xl">🗳️</div>
                  </div>
                  <p className="text-slate-400 text-sm">swipe to stake</p>
                  <p className="text-slate-500 text-xs">swipe right for YES, left for NO, up or down for next card</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 text-slate-500 text-xs space-y-2">
            <p className="text-slate-600">0.5% fee · 24h consensus · no gas</p>
          </div>
        </div>
      </div>

      {showStakingModal && stakingDirection && typeof document !== 'undefined' &&
        createPortal(
          <StakingModal
            question={currentCard.question}
            voteDirection={stakingDirection}
            onConfirm={handleConfirmStake}
            onCancel={() => {
              setShowStakingModal(false)
              setStakingDirection(null)
              setTransform({ x: 0, y: 0, rotate: 0 })
            }}
          />,
          document.body
        )
      }
    </>
  )
}
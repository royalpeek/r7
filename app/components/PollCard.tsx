'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

  // drag state
  const [dragging, setDragging] = useState(false)
  const [dir, setDir] = useState<'x' | 'y' | null>(null)
  const start = useRef({ x: 0, y: 0 })
  const [delta, setDelta] = useState({ x: 0, y: 0 })

  const isLocked = dragging || showStakingModal || showResults

  useEffect(() => {
    if (!isLocked) return

    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevOverscrollBody = (document.body.style as any).overscrollBehavior
    const prevOverscrollHtml = (document.documentElement.style as any).overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    ;(document.body.style as any).overscrollBehavior = 'none'
    ;(document.documentElement.style as any).overscrollBehavior = 'none'

    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
      ;(document.body.style as any).overscrollBehavior = prevOverscrollBody
      ;(document.documentElement.style as any).overscrollBehavior = prevOverscrollHtml
    }
  }, [isLocked])

  const lockNewGesture = () => {
    setDragging(true)
    setDir(null)
    setDelta({ x: 0, y: 0 })
  }

  const startGesture = (clientX: number, clientY: number) => {
    if (showStakingModal || showResults) return
    start.current = { x: clientX, y: clientY }
    lockNewGesture()
  }

  const moveGesture = (clientX: number, clientY: number) => {
    if (!dragging) return

    const dx = clientX - start.current.x
    const dy = clientY - start.current.y

    if (!dir) {
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (absX < 6 && absY < 6) return
      setDir(absY > absX ? 'y' : 'x')
    }

    if (dir === 'y') {
      setDelta({ x: 0, y: dy })
    } else if (dir === 'x') {
      setDelta({ x: dx, y: 0 })
    }
  }

  const endGesture = () => {
    if (!dragging) return

    const dx = delta.x
    const dy = delta.y
    const thresholdX = 80
    const thresholdY = 80

    setDragging(false)
    setDir(null)
    setDelta({ x: 0, y: 0 })

    // horizontal => vote
    if (Math.abs(dx) > thresholdX && Math.abs(dx) > Math.abs(dy)) {
      const voteDirection: 'YES' | 'NO' = dx > 0 ? 'YES' : 'NO'
      requestAnimationFrame(() => {
        setStakingDirection(voteDirection)
        setShowStakingModal(true)
      })
      return
    }

    // vertical => move polls
    if (Math.abs(dy) > thresholdY && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) setCurrentIndex(i => (i + 1) % cards.length) // swipe up => next
      else setCurrentIndex(i => (i - 1 + cards.length) % cards.length) // swipe down => prev
      return
    }
  }

  const handleConfirmStake = (amount: number) => {
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

    setShowStakingModal(false)
    setShowResults(true)
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
          setCurrentIndex(i => (i + 1) % cards.length)
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

  // stacked vertical deck transform: current index “slides” based on drag.y
  // we keep it stable by only transforming the deck container, not the page
  const deckY = dragging && dir === 'y' ? -currentIndex * 100 + (delta.y / (window?.innerHeight || 1)) * 100 : -currentIndex * 100

  return (
    <>
      <div className="bg-slate-950 min-h-screen w-full overflow-hidden touch-none overscroll-none">
        {/* deck */}
        <div
          className="relative w-full h-[100vh] max-h-[100vh] select-none touch-none"
          onTouchStart={e => startGesture(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => {
            if (e.touches.length > 1) return // reduce two-finger effects
            e.preventDefault()
            moveGesture(e.touches[0].clientX, e.touches[0].clientY)
          }}
          onTouchEnd={endGesture}
          onMouseDown={e => startGesture(e.clientX, e.clientY)}
          onMouseMove={e => {
            if (!dragging) return
            moveGesture(e.clientX, e.clientY)
          }}
          onMouseUp={endGesture}
          style={{
            touchAction: 'none',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate3d(0, ${-currentIndex * 100}%, 0)`,
            }}
          />

          {/* we render cards in a vertical column, only one is “active” visually */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate3d(0, ${(-currentIndex * 100)}%, 0)`,
            }}
          />

          {/* actual column */}
          <div
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translate3d(0, ${(-currentIndex * 100)}%, 0)`,
              willChange: 'transform',
            }}
          >
            {cards.map((c, i) => {
              const isCurrent = i === currentIndex
              return (
                <div key={c.id} className="w-full h-[100vh] max-h-[100vh] flex items-center justify-center px-4">
                  <div className="w-full max-w-sm bg-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="bg-cyan-900 text-cyan-400 px-3 py-1 rounded text-sm font-mono">
                        00:46:49
                      </div>
                      <div className="text-slate-400 text-sm">
                        ${100 + i * 50} USDC
                      </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-lg border border-slate-700 min-h-96 flex flex-col items-center justify-center">
                      <div className="text-center w-full">
                        <p className="text-white font-bold text-2xl mb-12">{c.question}</p>
                        <div className="space-y-4">
                          <div className="w-40 h-40 mx-auto bg-slate-800 rounded-lg flex items-center justify-center mb-4">
                            <div className="text-5xl">🗳️</div>
                          </div>
                          <p className="text-slate-400 text-sm">swipe to vote</p>
                          <p className="text-slate-500 text-xs">swipe right for yes, left for no</p>
                          <p className="text-slate-500 text-xs mt-2">swipe up/down for next poll</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* overlay to apply vertical drag without moving other page elements:
              we move the column by delta.y only while dragging vertically */}
          {dragging && dir === 'y' && (
            <div
              className="absolute inset-0"
              style={{
                transform: `translate3d(0, ${delta.y}px, 0)`,
                transition: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* bottom fee text */}
        <div className="text-center mt-8 text-slate-500 text-xs space-y-2 absolute left-0 right-0 bottom-4 pointer-events-none">
          <p className="text-slate-600">0.5% fee · 24h consensus · no gas</p>
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
            }}
          />,
          document.body
        )
      }
    </>
  )
}
'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import StakingModal from '../components/StakingModal'

const allPolls = [
  { id: 1, question: 'Is crypto the future of money?', yesPercent: 65, noPercent: 35, status: 'active', volume: 0 },
  { id: 2, question: 'Should couples split everything 50/50?', yesPercent: 58, noPercent: 42, status: 'ended', volume: 1755 },
  { id: 3, question: 'Is trash talking necessary in sports?', yesPercent: 72, noPercent: 28, status: 'ended', volume: 1156 },
  { id: 4, question: 'Is AI going to replace humans?', yesPercent: 80, noPercent: 20, status: 'ended', volume: 1256 },
  { id: 5, question: 'Should social media be regulated?', yesPercent: 45, noPercent: 55, status: 'active', volume: 0 },
  { id: 6, question: 'Is climate change the biggest threat?', yesPercent: 60, noPercent: 40, status: 'ended', volume: 980 },
]

type Poll = typeof allPolls[0]
type Vote = { pollId: number; direction: 'YES' | 'NO'; amount: number }

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null)
  const [vote, setVote] = useState<Vote | null>(null)
  const [stakingDirection, setStakingDirection] = useState<'YES' | 'NO' | null>(null)
  const [showStaking, setShowStaking] = useState(false)

  const filteredPolls = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return []
    return allPolls.filter(poll => poll.question.toLowerCase().includes(term))
  }, [searchTerm])

  // detail page for a selected poll
  if (selectedPoll) {
    const userVote = vote?.pollId === selectedPoll.id ? vote : null

    return (
      <div className="bg-slate-950 min-h-screen flex flex-col pb-24">
        {/* header */}
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => { setSelectedPoll(null); setVote(null) }}
            className="text-slate-400 text-lg"
          >
            ← Back
          </button>
          <div className="bg-cyan-900 text-cyan-400 px-3 py-1 rounded text-sm font-mono">
            {selectedPoll.status === 'active' ? '05:12:55' : 'Ended'}
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* question card */}
          <div className="bg-slate-800 rounded-2xl p-6">
            <p className="text-white font-bold text-2xl leading-tight mb-4">{selectedPoll.question}</p>
            {selectedPoll.status === 'active' && !userVote && (
              <>
                <p className="text-slate-400 text-sm mb-2">Swipe right for YES, left for NO</p>
                <p className="text-slate-500 text-xs">← NO · swipe · YES →</p>
              </>
            )}
          </div>

          {/* voting box */}
          <div className="bg-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-48">
            {userVote || selectedPoll.status === 'ended' ? (
              <div className="w-full space-y-4">
                <div className="h-10 bg-slate-700 rounded-full overflow-hidden flex items-center">
                  <div
                    className="h-full bg-cyan-400 rounded-full flex items-center justify-end pr-3"
                    style={{ width: `${selectedPoll.yesPercent}%` }}
                  >
                    <span className="text-black text-xs font-bold">YES</span>
                  </div>
                </div>
                <div className="h-10 bg-slate-700 rounded-full overflow-hidden flex items-center">
                  <div
                    className="h-full bg-pink-500 rounded-full flex items-center justify-end pr-3"
                    style={{ width: `${selectedPoll.noPercent}%` }}
                  >
                    <span className="text-black text-xs font-bold">NO</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-cyan-400">YES {selectedPoll.yesPercent}%</span>
                  <span className="text-pink-500">NO {selectedPoll.noPercent}%</span>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-5xl mb-3">🗳️</div>
                <p className="text-white font-bold mb-1">Vote to unlock insights</p>
                <p className="text-slate-400 text-sm text-center">Swipe above or tap the buttons below to cast your vote. Charts, odds, and pool data will appear after you vote.</p>
              </div>
            )}
          </div>

          {/* fee info */}
          <p className="text-center text-slate-500 text-xs">1% fee · 24h consensus · no gas</p>
        </div>

        {/* bottom buttons */}
        {selectedPoll.status === 'active' && (
          <div className="fixed bottom-20 left-0 right-0 p-4">
            <div className="flex gap-3 max-w-sm mx-auto">
              <button
                onClick={() => { setStakingDirection('NO'); setShowStaking(true) }}
                className="flex-1 bg-pink-500 text-black font-bold py-4 rounded-2xl"
              >
                STAKE NO
              </button>
              <button
                onClick={() => { setStakingDirection('YES'); setShowStaking(true) }}
                className="flex-1 bg-cyan-400 text-black font-bold py-4 rounded-2xl"
              >
                STAKE YES
              </button>
            </div>
          </div>
        )}

        {showStaking && stakingDirection && typeof document !== 'undefined' &&
          createPortal(
            <StakingModal
              question={selectedPoll.question}
              voteDirection={stakingDirection}
              onConfirm={(amount) => {
                setVote({ pollId: selectedPoll.id, direction: stakingDirection, amount })
                setShowStaking(false)
                setStakingDirection(null)
              }}
              onCancel={() => {
                setShowStaking(false)
                setStakingDirection(null)
              }}
            />,
            document.body
          )
        }
      </div>
    )
  }

  // search results list
  return (
    <div className="bg-slate-950 min-h-screen p-4 pb-24">
      <div className="mb-6">
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 gap-3">
          <span className="text-slate-500">🔍</span>
          <input
            type="text"
            placeholder="search polls..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredPolls.length === 0 && searchTerm.trim() !== '' && (
          <p className="text-slate-500 text-center mt-8">no polls found</p>
        )}

        {filteredPolls.map(poll => (
          <div
            key={poll.id}
            onClick={() => setSelectedPoll(poll)}
            className="bg-slate-900 p-4 rounded-2xl border border-slate-700 cursor-pointer active:opacity-80"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${poll.status === 'active' ? 'bg-cyan-400' : 'bg-slate-500'}`}></div>
                <span className={`text-xs ${poll.status === 'active' ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {poll.status === 'active' ? 'Active' : 'Ended'}
                </span>
              </div>
              <span className="text-slate-500 text-xs">${poll.volume.toLocaleString()} vol</span>
            </div>

            <p className="text-white font-bold mb-3">{poll.question}</p>

            <div className="space-y-2">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${poll.yesPercent}%` }}></div>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full" style={{ width: `${poll.noPercent}%` }}></div>
              </div>
            </div>

            <div className="flex justify-between mt-2">
              <span className="text-cyan-400 text-xs font-bold">{poll.yesPercent}% Yes</span>
              <span className="text-pink-500 text-xs font-bold">{poll.noPercent}% No</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import StakingModal from '../components/StakingModal'

const allPolls = [
  { id: 1, question: 'Is crypto the future of money?', yesPercent: 65, noPercent: 35, status: 'active', volume: 0, yesPool: 0, noPool: 0, yesVotes: 0, noVotes: 0 },
  { id: 2, question: 'Should couples split everything 50/50?', yesPercent: 58, noPercent: 42, status: 'ended', volume: 1755, yesPool: 1642, noPool: 114, yesVotes: 50, noVotes: 2 },
  { id: 3, question: 'Is trash talking necessary in sports?', yesPercent: 72, noPercent: 28, status: 'ended', volume: 1156, yesPool: 890, noPool: 266, yesVotes: 38, noVotes: 12 },
  { id: 4, question: 'Is AI going to replace humans?', yesPercent: 80, noPercent: 20, status: 'ended', volume: 1256, yesPool: 1005, noPool: 251, yesVotes: 44, noVotes: 8 },
  { id: 5, question: 'Should social media be regulated?', yesPercent: 45, noPercent: 55, status: 'active', volume: 0, yesPool: 0, noPool: 0, yesVotes: 0, noVotes: 0 },
  { id: 6, question: 'Is climate change the biggest threat?', yesPercent: 60, noPercent: 40, status: 'ended', volume: 980, yesPool: 720, noPool: 260, yesVotes: 30, noVotes: 10 },
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

  const userVote = vote?.pollId === selectedPoll?.id ? vote : null
  const hasResult = userVote || selectedPoll?.status === 'ended'

  return (
    <>
      {showStaking && stakingDirection && selectedPoll && typeof document !== 'undefined' &&
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

      {selectedPoll ? (
        <div className="bg-slate-950 min-h-screen">
          {/* header - stays at top */}
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => { setSelectedPoll(null); setVote(null) }}
              className="text-slate-400 text-lg"
            >
              ← Back
            </button>
            <div className={`px-3 py-1 rounded text-sm font-bold ${
              selectedPoll.status === 'active'
                ? 'bg-cyan-900 text-cyan-400 font-mono'
                : 'bg-pink-900 text-pink-400'
            }`}>
              {selectedPoll.status === 'active' ? '05:12:55' : 'ENDED'}
            </div>
          </div>

          {/* all content scrolls including buttons */}
          <div className="px-4 pb-32 space-y-5 overflow-y-auto">
            <div className="bg-slate-800 rounded-2xl p-6">
              <p className="text-white font-bold text-2xl leading-tight mb-3">{selectedPoll.question}</p>
              <p className="text-slate-600 text-xs mt-4">1% fee · 24h consensus · no gas</p>
            </div>

            {hasResult ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-slate-400 text-xs font-bold tracking-widest">
                    {selectedPoll.status === 'ended' ? 'FINAL PRICE' : 'CURRENT PRICE'}
                  </p>
                  <div className="flex gap-2">
                    <span className="text-cyan-400 font-bold">${(selectedPoll.yesPercent / 100).toFixed(2)}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-pink-500 font-bold">${(selectedPoll.noPercent / 100).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-4 h-48 flex items-center justify-center">
                  <p className="text-slate-500 text-sm">chart placeholder</p>
                </div>

                <div className="bg-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📊</span>
                    <div>
                      <p className="font-bold">
                        <span className="text-cyan-400">{selectedPoll.yesVotes || (userVote?.direction === 'YES' ? 1 : 0)} YES</span>
                        <span className="text-slate-500"> · </span>
                        <span className="text-pink-500">{selectedPoll.noVotes || (userVote?.direction === 'NO' ? 1 : 0)} NO</span>
                      </p>
                      <p className="text-slate-400 text-sm">${selectedPoll.volume || userVote?.amount} USDC total volume</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-slate-400 text-xs font-bold tracking-widest mb-3">POOL BREAKDOWN</p>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-slate-800 rounded-2xl p-4">
                      <p className="text-cyan-400 font-bold text-xl">${selectedPoll.yesPool || userVote?.amount || 0}</p>
                      <p className="text-slate-400 text-sm">YES Pool</p>
                    </div>
                    <div className="flex-1 bg-slate-800 rounded-2xl p-4">
                      <p className="text-pink-500 font-bold text-xl">${selectedPoll.noPool || 0}</p>
                      <p className="text-slate-400 text-sm">NO Pool</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-48">
                <div className="text-center">
                  <div className="text-5xl mb-3">🗳️</div>
                  <p className="text-white font-bold mb-2">Vote to unlock insights</p>
                  <p className="text-slate-400 text-sm">tap the buttons below to cast your vote. charts, odds, and pool data will appear after you vote.</p>
                </div>
              </div>
            )}

            {/* buttons sit naturally in the page flow, not floating */}
            {selectedPoll.status === 'active' && !userVote && (
              <div className="flex gap-3 pt-2">
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
            )}

            {selectedPoll.status === 'active' && userVote && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setStakingDirection(userVote.direction === 'YES' ? 'NO' : 'YES'); setShowStaking(true) }}
                  className={`flex-1 text-black font-bold py-4 rounded-2xl ${userVote.direction === 'YES' ? 'bg-pink-500' : 'bg-cyan-400'}`}
                >
                  CHANGE {userVote.direction === 'YES' ? 'NO' : 'YES'}
                </button>
                <button
                  onClick={() => { setStakingDirection(userVote.direction); setShowStaking(true) }}
                  className={`flex-1 text-black font-bold py-4 rounded-2xl ${userVote.direction === 'YES' ? 'bg-cyan-400' : 'bg-pink-500'}`}
                >
                  ADD {userVote.direction}
                </button>
              </div>
            )}
          </div>
        </div>

      ) : (
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
      )}
    </>
  )
}
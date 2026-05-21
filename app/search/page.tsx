'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import StakingModal from '../components/StakingModal'

const allPolls = [
  { id: 1, question: 'Is crypto the future of money?' },
  { id: 2, question: 'Should couples split everything 50/50?' },
  { id: 3, question: 'Is trash talking necessary in sports?' },
  { id: 4, question: 'Is AI going to replace humans?' },
  { id: 5, question: 'Should social media be regulated?' },
  { id: 6, question: 'Is climate change the biggest threat?' },
]

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activePoll, setActivePoll] = useState<{ poll: any; direction: 'YES' | 'NO' } | null>(null)

  const filteredPolls = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return []
    return allPolls.filter(poll => poll.question.toLowerCase().includes(term))
  }, [searchTerm])

  return (
    <div className="bg-slate-950 min-h-screen p-4 pb-48">
      <h1 className="text-2xl font-bold text-white mb-6">Search Polls</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="search polls..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900 text-white placeholder-slate-500 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-400"
        />
      </div>

      <div className="space-y-4">
        {filteredPolls.map(poll => (
          <div key={poll.id} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <p className="text-white font-bold mb-3">{poll.question}</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setActivePoll({ poll, direction: 'YES' })}
                className="flex-1 bg-cyan-900 text-cyan-400 font-bold py-2 rounded-lg"
              >
                YES
              </button>
              <button 
                onClick={() => setActivePoll({ poll, direction: 'NO' })}
                className="flex-1 bg-pink-900 text-pink-400 font-bold py-2 rounded-lg"
              >
                NO
              </button>
            </div>
          </div>
        ))}
      </div>

      {activePoll && typeof document !== 'undefined' &&
        createPortal(
          <StakingModal
            question={activePoll.poll.question}
            voteDirection={activePoll.direction}
            onConfirm={(amount) => {
              console.log(`Staked ${amount} on ${activePoll.direction}`)
              setActivePoll(null)
            }}
            onCancel={() => setActivePoll(null)}
          />,
          document.body
        )
      }
    </div>
  )
}
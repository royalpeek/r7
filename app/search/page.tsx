'use client'

import { useMemo, useState } from 'react'
// if StakingModal.tsx is in the same folder as this Search page, use './StakingModal'
// if it is in a folder named 'components' next to this folder, use '../components/StakingModal'
import StakingModal from './StakingModal' 

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
  const [selectedPoll, setSelectedPoll] = useState<(typeof allPolls)[number] | null>(null)

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

      <div className="space-y-3">
        {searchTerm.trim() === '' ? (
          <p className="text-slate-400 text-sm text-center mt-8">start typing to search polls</p>
        ) : filteredPolls.length === 0 ? (
          <p className="text-slate-400 text-sm text-center mt-8">no polls found</p>
        ) : (
          filteredPolls.map(poll => (
            <button
              key={poll.id}
              onClick={() => setSelectedPoll(poll)}
              className="w-full text-left bg-slate-900 p-4 rounded-lg border border-slate-700 cursor-pointer hover:border-cyan-400 transition"
            >
              <p className="text-white font-bold">{poll.question}</p>
            </button>
          ))
        )}
      </div>

      {selectedPoll && (
        <StakingModal
          poll={selectedPoll}
          onClose={() => setSelectedPoll(null)}
        />
      )}
    </div>
  )
}
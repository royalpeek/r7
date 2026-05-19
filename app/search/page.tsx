'use client'

import { useState } from 'react'

export default function Search() {
  const allPolls = [
    { id: 1, question: 'Is crypto the future of money?' },
    { id: 2, question: 'Should couples split everything 50/50?' },
    { id: 3, question: 'Is trash talking necessary in sports?' },
    { id: 4, question: 'Is AI going to replace humans?' },
    { id: 5, question: 'Should social media be regulated?' },
    { id: 6, question: 'Is climate change the biggest threat?' },
  ]

  const [searchTerm, setSearchTerm] = useState('')
  const [filteredPolls, setFilteredPolls] = useState<typeof allPolls>([])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase()
    setSearchTerm(term)

    if (term.trim() === '') {
      setFilteredPolls([])
    } else {
      const filtered = allPolls.filter(poll =>
        poll.question.toLowerCase().includes(term)
      )
      setFilteredPolls(filtered)
    }
  }

  return (
    <div className="bg-slate-950 min-h-screen p-4 pb-48">
      <h1 className="text-2xl font-bold text-white mb-6">Search Polls</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search polls..."
          value={searchTerm}
          onChange={handleSearch}
          className="w-full bg-slate-900 text-white placeholder-slate-500 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-400"
        />
      </div>

      <div className="space-y-3">
        {searchTerm.trim() === '' ? (
          <p className="text-slate-400 text-sm text-center mt-8">Start typing to search polls</p>
        ) : filteredPolls.length === 0 ? (
          <p className="text-slate-400 text-sm text-center mt-8">No polls found</p>
        ) : (
          filteredPolls.map(poll => (
            <div
              key={poll.id}
              className="bg-slate-900 p-4 rounded-lg border border-slate-700 cursor-pointer hover:border-cyan-400 transition"
            >
              <p className="text-white font-bold">{poll.question}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
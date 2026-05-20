'use client'

import { useState } from 'react'

const activePositions = [
  { id: 1, question: 'Is crypto the future of money?', vote: 'YES', stake: 50, pnl: +12.40, timeLeft: '02:14:33', yesPercent: 65, noPercent: 35 },
  { id: 2, question: 'Should couples split everything 50/50?', vote: 'NO', stake: 25, pnl: -4.20, timeLeft: '00:46:49', yesPercent: 58, noPercent: 42 },
]

const historyPositions = [
  { id: 3, question: 'Is trash talking necessary in sports?', vote: 'YES', stake: 100, pnl: +88.50, resolved: 'YES won', date: 'May 18, 2026' },
  { id: 4, question: 'Do you think good people are always weak?', vote: 'NO', stake: 30, pnl: -30.00, resolved: 'YES won', date: 'May 15, 2026' },
  { id: 5, question: 'Is climate change the biggest threat?', vote: 'YES', stake: 75, pnl: +60.00, resolved: 'YES won', date: 'May 10, 2026' },
]

type SortOption = 'newest' | 'oldest' | 'highest_stake' | 'lowest_stake' | 'best_pnl' | 'worst_pnl'

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState('active')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const sortLabel: Record<SortOption, string> = {
    newest: 'Newest', oldest: 'Oldest', highest_stake: 'Highest Stake', lowest_stake: 'Lowest Stake', best_pnl: 'Best P&L', worst_pnl: 'Worst P&L',
  }

  const sortedHistory = [...historyPositions].sort((a, b) => {
    if (sortBy === 'newest') return b.id - a.id
    if (sortBy === 'oldest') return a.id - b.id
    if (sortBy === 'highest_stake') return b.stake - a.stake
    if (sortBy === 'lowest_stake') return a.stake - b.stake
    if (sortBy === 'best_pnl') return b.pnl - a.pnl
    if (sortBy === 'worst_pnl') return a.pnl - b.pnl
    return 0
  })

  return (
    <div className="bg-slate-950 h-screen flex flex-col">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">r7</h1>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <p className="text-slate-400 text-sm mb-2">Total USDC Balance</p>
          <p className="text-white text-4xl font-bold">$65.643</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <p className="text-slate-400 text-sm mb-1">P&L</p>
            <p className="text-cyan-400 text-2xl font-bold">+$299.70</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <p className="text-slate-400 text-sm mb-1">Claimable</p>
            <p className="text-slate-300 text-2xl font-bold">$0.00</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-700">
          <div className="flex gap-4">
            <button onClick={() => setActiveTab('active')} className={`pb-4 font-semibold ${activeTab === 'active' ? 'text-white border-b-2 border-cyan-400' : 'text-slate-400'}`}>
              Active ({activePositions.length})
            </button>
            <button onClick={() => setActiveTab('history')} className={`pb-4 font-semibold ${activeTab === 'history' ? 'text-white border-b-2 border-cyan-400' : 'text-slate-400'}`}>
              History ({historyPositions.length})
            </button>
          </div>
          <div className="relative pb-4">
            <button onClick={() => setShowSortMenu(!showSortMenu)} className="text-slate-400 text-sm flex items-center gap-1">↕ {sortLabel[sortBy]}</button>
            {showSortMenu && (
              <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded-xl z-10 w-44 overflow-hidden">
                {(Object.keys(sortLabel) as SortOption[]).map(option => (
                  <button key={option} onClick={() => { setSortBy(option); setShowSortMenu(false); }} className={`w-full text-left px-4 py-3 text-sm ${sortBy === option ? 'text-cyan-400 bg-slate-700' : 'text-slate-300'}`}>
                    {sortLabel[option]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-48">
        {activeTab === 'active' && (
          <div className="space-y-4">
            {activePositions.length === 0 ? (
              <div className="text-center py-16 text-slate-400">No active positions</div>
            ) : (
              activePositions.map(pos => (
                <div key={pos.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-white font-semibold text-sm flex-1 pr-4">{pos.question}</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${pos.vote === 'YES' ? 'bg-cyan-900 text-cyan-400' : 'bg-pink-900 text-pink-400'}`}>{pos.vote}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-slate-400">Stake: <span className="text-white font-bold">${pos.stake}</span></span>
                    <span className={`font-bold ${pos.pnl >= 0 ? 'text-cyan-400' : 'text-pink-400'}`}>{pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="w-full bg-slate-700 rounded-full h-1.5 mr-4"><div className="bg-cyan-400 h-1.5 rounded-full" style={{ width: `${pos.yesPercent}%` }} /></div>
                    <span className="text-cyan-400 text-xs font-mono whitespace-nowrap">{pos.timeLeft}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {sortedHistory.map(pos => (
              <div key={pos.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-white font-semibold text-sm flex-1 pr-4">{pos.question}</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${pos.vote === 'YES' ? 'bg-cyan-900 text-cyan-400' : 'bg-pink-900 text-pink-400'}`}>{pos.vote}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-400">Stake: <span className="text-white font-bold">${pos.stake}</span></span>
                  <span className={`font-bold ${pos.pnl >= 0 ? 'text-cyan-400' : 'text-pink-400'}`}>{pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">{pos.date}</span>
                  <span className={`text-xs font-semibold ${pos.resolved.includes(pos.vote) ? 'text-cyan-400' : 'text-pink-400'}`}>{pos.resolved}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
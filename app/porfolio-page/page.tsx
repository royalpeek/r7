'use client'

import { useState } from 'react'

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState('active')

  return (
    <div className="bg-slate-950 min-h-screen p-4">
      {/* header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-6">b⁴</h1>
      </div>

      {/* total balance */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
        <p className="text-slate-400 text-sm mb-2">Total USDC Balance</p>
        <p className="text-white text-4xl font-bold">$65.643</p>
      </div>

      {/* p&l and claimable */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <p className="text-slate-400 text-sm mb-2">P&L</p>
          <p className="text-cyan-400 text-2xl font-bold">+$299.70</p>
          <p className="text-slate-500 text-xs mt-2">→</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <p className="text-slate-400 text-sm mb-2">Claimable</p>
          <p className="text-slate-300 text-2xl font-bold">$0.00</p>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-4 mb-8 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-4 font-semibold ${
            activeTab === 'active'
              ? 'text-white border-b-2 border-cyan-400'
              : 'text-slate-400'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 font-semibold ${
            activeTab === 'history'
              ? 'text-white border-b-2 border-cyan-400'
              : 'text-slate-400'
          }`}
        >
          History (175)
        </button>
      </div>

      {/* content */}
      {activeTab === 'active' && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-lg mb-2">No active positions</p>
          <p className="text-slate-500 text-sm">Swipe on a market to place your first stake</p>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-lg">History coming soon</p>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState } from 'react'
import { Gift, Users, LogOut, Copy, Check, Ticket } from 'lucide-react'

export default function Profile() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText('3wbjCZ...kDdM')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-slate-950 min-h-screen p-4 pb-32">

      {/* avatar and username */}
      <div className="flex flex-col items-center mb-8 pt-4">
        <div className="w-20 h-20 rounded-full bg-cyan-400 flex items-center justify-center mb-3">
          <span className="text-black text-3xl font-bold">R</span>
        </div>
        <p className="text-white font-bold text-xl">@royalpossible</p>
        <p className="text-slate-400 text-sm mt-1">Opinion Staker</p>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-white font-bold text-xl">62%</p>
          <p className="text-slate-400 text-xs mt-1">Win Rate</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-cyan-400 font-bold text-xl">$1,204</p>
          <p className="text-slate-400 text-xs mt-1">Earnings</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-white font-bold text-xl">175</p>
          <p className="text-slate-400 text-xs mt-1">Total Votes</p>
        </div>
      </div>

      {/* wallet address */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4">
        <p className="text-slate-400 text-xs mb-2">Wallet Address</p>
        <div className="flex items-center justify-between">
          <p className="text-white font-mono text-sm">3wbjCZ...kDdM</p>
          <button
            onClick={handleCopy}
            className="text-cyan-400 text-xs bg-slate-800 px-3 py-1 rounded-lg flex items-center gap-1"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* badges */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4">
        <p className="text-slate-400 text-xs mb-3">Badges</p>
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-cyan-400 text-lg font-bold">🔥</span>
            </div>
            <p className="text-slate-400 text-xs">On Fire</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-cyan-400 text-lg font-bold">🎯</span>
            </div>
            <p className="text-slate-400 text-xs">Sharp</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-cyan-400 text-lg font-bold">⚡</span>
            </div>
            <p className="text-slate-400 text-xs">Early</p>
          </div>
        </div>
      </div>

      {/* invite and referrals */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center gap-2">
          <Gift size={24} className="text-cyan-400" />
          <p className="text-white text-sm font-semibold">Invite</p>
        </button>
        <button className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center gap-2">
          <Users size={24} className="text-cyan-400" />
          <p className="text-white text-sm font-semibold">My Referrals</p>
        </button>
      </div>

      {/* referral code */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Ticket size={14} className="text-slate-400" />
          <p className="text-slate-400 text-xs">Have a Referral Code?</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter code"
            className="flex-1 bg-slate-800 text-white placeholder-slate-500 px-3 py-2 rounded-lg text-sm focus:outline-none border border-slate-700"
          />
          <button className="bg-cyan-400 text-black font-bold px-4 py-2 rounded-lg text-sm">
            Apply
          </button>
        </div>
      </div>

      {/* sign out */}
      <button className="w-full bg-slate-900 border border-pink-500 text-pink-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
        <LogOut size={18} />
        Sign Out
      </button>

      {/* version */}
      <p className="text-center text-slate-600 text-xs mt-6">v1.0.0</p>
    </div>
  )
}
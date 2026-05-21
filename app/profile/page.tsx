'use client'

import { useState } from 'react'

export default function Profile() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText('3wbjCZ...kDdM')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-slate-950 min-h-screen p-4 pb-32">
      {/* header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">profile</h1>
      </div>

      {/* avatar and username */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-cyan-400 flex items-center justify-center mb-3">
          <span className="text-black text-3xl font-bold">R</span>
        </div>
        <p className="text-white font-bold text-xl">@royalpossible</p>
        <p className="text-slate-400 text-sm mt-1">opinion staker</p>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-white font-bold text-xl">62%</p>
          <p className="text-slate-400 text-xs mt-1">win rate</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-cyan-400 font-bold text-xl">$1,204</p>
          <p className="text-slate-400 text-xs mt-1">earnings</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-white font-bold text-xl">175</p>
          <p className="text-slate-400 text-xs mt-1">total votes</p>
        </div>
      </div>

      {/* wallet address */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4">
        <p className="text-slate-400 text-xs mb-2">wallet address</p>
        <div className="flex items-center justify-between">
          <p className="text-white font-mono text-sm">3wbjCZ...kDdM</p>
          <button
            onClick={handleCopy}
            className="text-cyan-400 text-xs bg-slate-800 px-3 py-1 rounded-lg"
          >
            {copied ? 'copied!' : 'copy'}
          </button>
        </div>
      </div>

      {/* badges */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4">
        <p className="text-slate-400 text-xs mb-3">badges</p>
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-2xl">🔥</span>
            </div>
            <p className="text-slate-400 text-xs">on fire</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <p className="text-slate-400 text-xs">sharp</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
            <p className="text-slate-400 text-xs">early</p>
          </div>
        </div>
      </div>

      {/* invite and referrals */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center gap-2">
          <span className="text-2xl">🎁</span>
          <p className="text-white text-sm font-semibold">invite</p>
        </button>
        <button className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center gap-2">
          <span className="text-2xl">👥</span>
          <p className="text-white text-sm font-semibold">my referrals</p>
        </button>
      </div>

      {/* referral code */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6">
        <p className="text-slate-400 text-xs mb-2">have a referral code?</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="enter code"
            className="flex-1 bg-slate-800 text-white placeholder-slate-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-cyan-400 border border-slate-700"
          />
          <button className="bg-cyan-400 text-black font-bold px-4 py-2 rounded-lg text-sm">
            apply
          </button>
        </div>
      </div>

      {/* sign out */}
      <button className="w-full bg-slate-900 border border-pink-500 text-pink-500 font-bold py-4 rounded-2xl">
        sign out
      </button>

      {/* version */}
      <p className="text-center text-slate-600 text-xs mt-6">v1.0.0</p>
    </div>
  )
}
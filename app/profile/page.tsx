'use client'

import { useState, useEffect } from 'react'
import { Gift, Users, LogOut, Copy, Check, Ticket } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Profile() {
  const [copied, setCopied] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [totalVotes, setTotalVotes] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const WebApp = require('@twa-dev/sdk').default
    const user = WebApp.initDataUnsafe.user

    if (user) {
      setUsername(user.username || user.first_name || 'unknown')
      setFirstName(user.first_name || null)
      setUserId(user.id.toString())
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    const fetchVotes = async () => {
      const { count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      setTotalVotes(count ?? 0)
    }

    fetchVotes()
  }, [userId])

  const handleCopy = () => {
    navigator.clipboard.writeText('3wbjCZ...kDdM')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const avatarLetter = (firstName || username || '?')[0].toUpperCase()

  return (
    <div className="bg-slate-950 min-h-screen p-4 pb-32">

      {/* avatar and username */}
      <div className="flex flex-col items-center mb-8 pt-4">
        <div className="w-20 h-20 rounded-full bg-cyan-400 flex items-center justify-center mb-3">
          <span className="text-black text-3xl font-bold">{avatarLetter}</span>
        </div>
        <p className="text-white font-bold text-xl">
          {username ? `@${username}` : 'loading...'}
        </p>
        <p className="text-slate-400 text-sm mt-1">Opinion Staker</p>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-slate-500 font-bold text-xl">--</p>
          <p className="text-slate-400 text-xs mt-1">Win Rate</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-slate-500 font-bold text-xl">--</p>
          <p className="text-slate-400 text-xs mt-1">Earnings</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-white font-bold text-xl">
            {totalVotes === null ? '...' : totalVotes}
          </p>
          <p className="text-slate-400 text-xs mt-1">Total Votes</p>
        </div>
      </div>

      {/* badges */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4">
        <p className="text-slate-400 text-xs mb-3">Badges</p>
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-lg">🔥</span>
            </div>
            <p className="text-slate-400 text-xs">On Fire</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
            <p className="text-slate-400 text-xs">Sharp</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-lg">⚡</span>
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

      <p className="text-center text-slate-600 text-xs mt-6">v1.0.0</p>
    </div>
  )
}
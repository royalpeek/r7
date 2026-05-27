'use client'

import { useEffect, useMemo, useState } from 'react'
import { Gift, Users, LogOut, Ticket } from 'lucide-react'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'

export default function Profile() {
  const [totalVotes, setTotalVotes] = useState<number | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [hasAppliedReferral, setHasAppliedReferral] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [referralMessage, setReferralMessage] = useState<string | null>(null)
  const [referralError, setReferralError] = useState<string | null>(null)
  const [applyingReferral, setApplyingReferral] = useState(false)
  const { userId, user, initData, loading } = useTelegramUser()
  const username = user?.username || user?.first_name || null
  const avatarLetter = useMemo(() => (user?.first_name || username || '?')[0].toUpperCase(), [user?.first_name, username])

  useEffect(() => {
    if (!userId) return

    const fetchProfileData = async () => {
      try {
        const [statsResponse, referralResponse] = await Promise.all([
          fetch('/api/me/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          }),
          fetch('/api/me/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          }),
        ])

        const statsData = await statsResponse.json()
        const referralData = await referralResponse.json()

        if (!statsResponse.ok) {
          setStatsError(true)
          setTotalVotes(0)
        } else {
          setStatsError(false)
          setTotalVotes(statsData.totalVotes)
        }

        if (referralResponse.ok) {
          setReferralCode(referralData.referralCode || '')
          setReferralCount(referralData.referralCount || 0)
          setHasAppliedReferral(Boolean(referralData.hasAppliedReferral))
        }
      } catch (error) {
        console.error('fetch profile data error:', error)
        setStatsError(true)
        setTotalVotes(0)
      }
    }

    fetchProfileData()
  }, [initData, userId])

  const handleCopyReferralCode = async () => {
    if (!referralCode) return
    await navigator.clipboard.writeText(referralCode)
    setReferralError(null)
    setReferralMessage('Referral code copied.')
  }

  const handleApplyReferralCode = async () => {
    setApplyingReferral(true)
    setReferralError(null)
    setReferralMessage(null)

    try {
      const response = await fetch('/api/referrals/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, code: codeInput }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to apply referral code')

      setCodeInput('')
      setHasAppliedReferral(true)
      setReferralMessage('Referral code applied.')
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : 'Failed to apply referral code')
    } finally {
      setApplyingReferral(false)
    }
  }

  return (
    <div className="bg-slate-950 min-h-screen p-4 pb-28">

      {/* avatar and username */}
      <div className="flex flex-col items-center mb-6 pt-2">
        <div className="w-16 h-16 rounded-full bg-cyan-400 flex items-center justify-center mb-3">
          <span className="text-black text-2xl font-bold">{avatarLetter}</span>
        </div>
        <p className="text-white font-bold text-xl">
          {username ? `@${username}` : loading ? 'loading...' : '@unknown'}
        </p>
        <p className="text-slate-400 text-sm mt-1">Opinion Staker</p>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-slate-500 font-bold text-lg">--</p>
          <p className="text-slate-400 text-xs mt-1">Win Rate</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-slate-500 font-bold text-lg">--</p>
          <p className="text-slate-400 text-xs mt-1">Earnings</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-white font-bold text-lg">
            {totalVotes === null ? '...' : totalVotes}
          </p>
          <p className="text-slate-400 text-xs mt-1">Total Votes</p>
        </div>
      </div>

      {statsError && (
        <div className="mb-4 rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-center">
          <p className="text-pink-200 text-sm">Could not refresh profile stats.</p>
        </div>
      )}

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
          <p className="text-white text-sm font-semibold">{referralCode || 'Invite'}</p>
        </button>
        <button className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center gap-2">
          <Users size={24} className="text-cyan-400" />
          <p className="text-white text-sm font-semibold">{referralCount} Referrals</p>
        </button>
      </div>

      {/* referral code */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Ticket size={14} className="text-slate-400" />
            <p className="text-slate-400 text-xs">Referral</p>
          </div>
          <button
            onClick={handleCopyReferralCode}
            disabled={!referralCode}
            className="text-cyan-400 text-xs font-bold disabled:text-slate-600"
          >
            Copy Code
          </button>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 mb-3">
          <p className="text-slate-500 text-xs">Your code</p>
          <p className="text-white font-mono font-bold">{referralCode || 'loading...'}</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter code"
            value={codeInput}
            disabled={hasAppliedReferral || applyingReferral}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            className="flex-1 bg-slate-800 text-white placeholder-slate-500 px-3 py-2 rounded-lg text-sm focus:outline-none border border-slate-700"
          />
          <button
            onClick={handleApplyReferralCode}
            disabled={hasAppliedReferral || applyingReferral || !codeInput.trim()}
            className="bg-cyan-400 text-black font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applyingReferral ? 'Applying' : hasAppliedReferral ? 'Applied' : 'Apply'}
          </button>
        </div>
        {referralMessage && <p className="text-cyan-400 text-xs mt-3">{referralMessage}</p>}
        {referralError && <p className="text-pink-300 text-xs mt-3">{referralError}</p>}
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

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Wallet, RefreshCw, PlusCircle, Send, QrCode, Filter, Lock, MapPin, Zap } from 'lucide-react'
import PollCard from './components/PollCard'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { usePolls } from './hooks/usePolls'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'

const CATEGORIES = ['Trending', 'New', 'Politics', 'Crypto', 'Sports', 'Tech']

export default function Home() {
  const haptics = useHapticFeedback()
  const [showWallet, setShowWallet] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Trending')
  const [filterStatus, setFilterStatus] = useState('active')
  const [sortBy, setSortBy] = useState('oldest')
  const [showDetail, setShowDetail] = useState(false)

  // create poll form state
  const [pollTitle, setPollTitle] = useState('')
  const [pollDescription, setPollDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isLocal, setIsLocal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const { userId, appUser, initData, loading: userLoading } = useTelegramUser()
  const { polls, loading: pollsLoading, refetch } = usePolls(userId, initData)
  const isCreator = appUser?.is_creator || false
  const balance = Number(appUser?.balance ?? 0)

  const handleCopy = () => {
    navigator.clipboard.writeText('3wbjCZ...kDdM')
  }

  const handleCreatePoll = async () => {
    if (!pollTitle.trim()) {
      setCreateError('please enter a title')
      return
    }
    if (!userId) {
      setCreateError('user not found')
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: pollTitle,
          initData,
          description: pollDescription,
          category: 'general',
          is_private: isPrivate,
        }),
      })

      if (!response.ok) throw new Error('failed to create poll')

      // reset form and close modal
      setPollTitle('')
      setPollDescription('')
      setIsPrivate(false)
      setIsLocal(false)
      setShowCreatePoll(false)
      refetch()
    } catch {
      setCreateError('failed to create poll. try again.')
    } finally {
      setCreating(false)
    }
  }

  const loading = userLoading || pollsLoading

  // filter and sort polls
  const filteredPolls = polls
    .filter(poll => {
      const marketEnded = new Date(poll.ends_at) < new Date()
      return filterStatus === 'active' ? !marketEnded : marketEnded
    })
    .sort((a, b) => {
      const totalA = a.yes_pool + a.no_pool
      const totalB = b.yes_pool + b.no_pool

      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'highest-volume':
          return totalB - totalA
        case 'lowest-volume':
          return totalA - totalB
        case 'most-votes':
          return (b.yes_votes + b.no_votes) - (a.yes_votes + a.no_votes)
        case 'fewest-votes':
          return (a.yes_votes + a.no_votes) - (b.yes_votes + b.no_votes)
        default:
          return 0
      }
    })

  return (
    <div className="bg-slate-950 h-screen overflow-hidden flex flex-col">

      {/* header - logo and wallet on same line */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0 gap-3">
        {/* logo - left side, smaller and aligned with filter */}
        <Image src="/logo.png" alt="r7" width={64} height={32} className="h-8 w-auto" priority />

        {/* spacer - pushes wallet to right */}
        <div className="flex-1"></div>

        {/* wallet button - right side */}
        <button
          onClick={() => setShowWallet(true)}
          className="bg-slate-800 text-slate-400 px-4 py-2 rounded text-sm flex items-center gap-2 whitespace-nowrap"
        >
          ${balance.toFixed(2)} USDT
        </button>
      </div>

      {/* filter and create section */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
        <button
          onClick={() => setShowFilter(true)}
          className="bg-slate-800 text-slate-400 p-2 rounded border border-slate-700 hover:text-slate-300 transition"
          title="Filter"
        >
          <Filter size={20} />
        </button>

        {isCreator && (
          <button
            onClick={() => {
              haptics.impact('medium')
              setShowCreatePoll(true)
            }}
            className="ml-auto flex items-center gap-2 bg-cyan-400 text-black px-4 py-2 rounded-xl font-bold hover:bg-cyan-500 transition"
          >
            <PlusCircle size={18} />
            Create
          </button>
        )}
      </div>

      {/* category tabs - ONLY show on home page, NOT on detail page */}
      {!showDetail && (
        <div className="flex gap-4 px-4 pb-3 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap pb-2 text-sm font-medium transition border-b-2 ${
                selectedCategory === cat
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-400 border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* poll card fills remaining space */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">loading polls...</p>
          </div>
        ) : filteredPolls.length > 0 ? (
          <PollCard
            polls={filteredPolls}
            availableBalance={balance}
            onDetailChange={setShowDetail}
            onPollsChange={refetch}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">no polls yet</p>
          </div>
        )}
      </div>

      {/* create poll modal */}
      {showCreatePoll && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 overflow-y-auto">
          <div className="flex-1 p-6 pb-12">
            {/* back button */}
            <button
              onClick={() => {
                setShowCreatePoll(false)
                setCreateError(null)
                setPollTitle('')
                setPollDescription('')
                setIsPrivate(false)
                setIsLocal(false)
              }}
              className="text-slate-400 text-sm mb-6 flex items-center gap-1"
            >
              ← Back
            </button>

            <h2 className="text-white text-3xl font-bold mb-4">Create Poll</h2>

            {/* polls remaining badge */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <Zap size={16} className="text-pink-400" />
              <span className="text-pink-400 text-sm font-medium">2/2 polls remaining today</span>
            </div>

            {/* title input */}
            <div className="mb-5">
              <p className="text-white text-sm font-medium mb-2">
                Title <span className="text-slate-500">{pollTitle.length}/64</span>
              </p>
              <input
                type="text"
                maxLength={64}
                value={pollTitle}
                onChange={e => setPollTitle(e.target.value)}
                placeholder="Is Solana better than Ethereum?"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* description input */}
            <div className="mb-5">
              <p className="text-white text-sm font-medium mb-2">
                Description <span className="text-slate-500">{pollDescription.length}/256</span>
              </p>
              <textarea
                maxLength={256}
                value={pollDescription}
                onChange={e => setPollDescription(e.target.value)}
                placeholder="Optional description for your market..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            {/* private poll toggle */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock size={18} className="text-slate-400" />
                <span className="text-white font-medium">Private Poll</span>
              </div>
              <button
                onClick={() => setIsPrivate(prev => !prev)}
                className={`w-12 h-6 rounded-full transition-colors ${isPrivate ? 'bg-cyan-400' : 'bg-slate-700'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* local poll toggle */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-slate-400" />
                <span className="text-white font-medium">Local Poll</span>
              </div>
              <button
                onClick={() => setIsLocal(prev => !prev)}
                className={`w-12 h-6 rounded-full transition-colors ${isLocal ? 'bg-cyan-400' : 'bg-slate-700'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${isLocal ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* creator earnings info */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💰</span>
                <span className="text-white font-bold">Creator Earnings</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Your cut</span>
                <span className="text-cyan-400 text-sm font-medium">0.25% win · 0.5% lose</span>
              </div>
              <p className="text-slate-500 text-xs">
                When your poll resolves, you earn 0.25% of the winning pool and 0.5% of the losing pool, paid directly in USDT.
              </p>
            </div>

            {/* error message */}
            {createError && (
              <p className="text-pink-400 text-sm mb-4">{createError}</p>
            )}

            {/* create button */}
            <button
              onClick={handleCreatePoll}
              disabled={creating || !pollTitle.trim()}
              className="w-full bg-cyan-400 text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-500 transition"
            >
              {creating ? 'Creating...' : 'Create Poll'}
            </button>
          </div>
        </div>
      )}

      {/* filter modal */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowFilter(false)}
          />
          <div className="relative bg-slate-950 rounded-t-3xl p-6 pb-12 z-10 max-h-96 overflow-y-auto">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-6" />
            <button
              onClick={() => setShowFilter(false)}
              className="absolute top-6 right-6 text-slate-400"
            >
              <X size={20} />
            </button>

            <p className="text-white text-2xl font-bold mb-6">Filter</p>

            {/* status filter */}
            <div className="mb-8">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">STATUS</p>
              <div className="space-y-3">
                <button
                  onClick={() => { setFilterStatus('active'); setShowFilter(false) }}
                  className={`w-full flex items-center justify-between py-3 px-4 rounded-lg border transition ${
                    filterStatus === 'active'
                      ? 'bg-cyan-900 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>Active</span>
                  {filterStatus === 'active' && <span>✓</span>}
                </button>
                <button
                  onClick={() => { setFilterStatus('expired'); setShowFilter(false) }}
                  className={`w-full flex items-center justify-between py-3 px-4 rounded-lg border transition ${
                    filterStatus === 'expired'
                      ? 'bg-cyan-900 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>Expired</span>
                  {filterStatus === 'expired' && <span>✓</span>}
                </button>
              </div>
            </div>

            {/* sort options */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">SORT BY</p>
              <div className="space-y-2">
                {[
                  { value: 'newest', label: 'Newest' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'highest-volume', label: 'Highest Volume' },
                  { value: 'lowest-volume', label: 'Lowest Volume' },
                  { value: 'most-votes', label: 'Most Votes' },
                  { value: 'fewest-votes', label: 'Fewest Votes' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => { setSortBy(option.value); setShowFilter(false) }}
                    className={`w-full text-left py-2 px-4 rounded transition ${
                      sortBy === option.value
                        ? 'bg-slate-800 text-cyan-400'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {sortBy === option.value && '✓ '}{option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* wallet sheet overlay */}
      {showWallet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowWallet(false)}
          />
          <div className="relative bg-slate-950 rounded-t-3xl p-6 pb-12 z-10">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-6" />
            <button
              onClick={() => setShowWallet(false)}
              className="absolute top-6 right-6 text-slate-400"
            >
              <X size={20} />
            </button>
            <p className="text-white text-2xl font-bold mb-1">Wallet</p>
            <p className="text-slate-400 text-sm mb-6">yourname@gmail.com</p>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet size={18} className="text-cyan-400" />
                <p className="text-white font-mono text-sm">3wbjCZ...kDdM</p>
              </div>
              <button onClick={handleCopy}>
                <QrCode size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6">
              <p className="text-slate-400 text-xs mb-2">USDT Balance</p>
              <div className="flex items-center justify-between">
              <p className="text-white text-3xl font-bold">${balance.toFixed(2)}</p>
                <button className="bg-slate-800 p-2 rounded-full">
                  <RefreshCw size={16} className="text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mb-6">
              <button disabled className="flex-1 bg-slate-800 text-slate-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed">
                <PlusCircle size={18} />
                Add Funds Soon
              </button>
              <button disabled className="flex-1 bg-slate-900 border border-slate-700 text-slate-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed">
                <Send size={18} />
                Send Soon
              </button>
            </div>
            <button className="w-full flex items-center justify-center gap-2 text-slate-400 text-sm py-2">
              <span>🎟️</span>
              Have a referral code?
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

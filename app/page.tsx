'use client'

import { useState, useEffect } from 'react'
import { X, Wallet, RefreshCw, PlusCircle, Send, QrCode, Filter } from 'lucide-react'
import PollCard from './components/PollCard'
import { usePolls } from './hooks/usePolls'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { supabase } from '@/lib/supabase'

const CATEGORIES = ['Trending', 'New', 'Politics', 'Crypto', 'Sports', 'Tech']

export default function Home() {
  const [showWallet, setShowWallet] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Trending')
  const [filterStatus, setFilterStatus] = useState('active')
  const [sortBy, setSortBy] = useState('oldest')
  const [isCreator, setIsCreator] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const { userId, loading: userLoading } = useTelegramUser()
  const { polls, loading: pollsLoading } = usePolls(userId)

  // capture console logs
  useEffect(() => {
    const originalLog = console.log
    const originalError = console.error

    console.log = (...args) => {
      originalLog(...args)
      setLogs(prev => [...prev, 'LOG: ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')])
    }

    console.error = (...args) => {
      originalError(...args)
      setLogs(prev => [...prev, 'ERROR: ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')])
    }

    return () => {
      console.log = originalLog
      console.error = originalError
    }
  }, [])

  // fetch user's creator status
  useEffect(() => {
    const fetchCreatorStatus = async () => {
      if (!userId) return
      try {
        console.log('fetching creator status for user:', userId)
        const { data, error } = await supabase
          .from('users')
          .select('is_creator')
          .eq('id', userId)
          .single()

        if (error) throw error
        console.log('creator status:', data?.is_creator)
        setIsCreator(data?.is_creator || false)
      } catch (err) {
        console.error('fetch creator status error:', err)
        setIsCreator(false)
      }
    }

    fetchCreatorStatus()
  }, [userId])

  const handleCopy = () => {
    navigator.clipboard.writeText('3wbjCZ...kDdM')
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
      {/* debug logs */}
      <div className="fixed top-0 left-0 right-0 bg-red-900 text-red-400 text-xs p-2 z-50 max-h-32 overflow-y-auto">
        <div className="font-bold mb-1">DEBUG:</div>
        <div>userId: {userId || 'loading...'}</div>
        <div>isCreator: {isCreator.toString()}</div>
        <div>userLoading: {userLoading.toString()}</div>
        <div className="border-t border-red-700 mt-2 pt-2">
          {logs.slice(-8).map((log, i) => (
            <div key={i} className="text-xs break-words">{log}</div>
          ))}
        </div>
      </div>

      {/* header - moved down to avoid debug box */}
      <div className="flex items-center justify-between px-4 pt-36 pb-2 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">r7</h1>
        <button
          onClick={() => setShowWallet(true)}
          className="bg-slate-800 text-slate-400 px-4 py-2 rounded text-sm flex items-center gap-2"
        >
          $64.167 USDT
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
          <button className="ml-auto flex items-center gap-2 bg-cyan-400 text-black px-4 py-2 rounded-xl font-bold hover:bg-cyan-500 transition">
            <PlusCircle size={18} />
            Create
          </button>
        )}
      </div>

      {/* category tabs */}
      <div className="flex gap-4 px-4 pb-4 overflow-x-auto flex-shrink-0 scrollbar-hide">
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

      {/* poll card fills remaining space */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">loading polls...</p>
          </div>
        ) : filteredPolls.length > 0 ? (
          <PollCard polls={filteredPolls} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">no polls yet</p>
          </div>
        )}
      </div>

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
                <p className="text-white text-3xl font-bold">$64.167</p>
                <button className="bg-slate-800 p-2 rounded-full">
                  <RefreshCw size={16} className="text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mb-6">
              <button className="flex-1 bg-cyan-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
                <PlusCircle size={18} />
                Add Funds
              </button>
              <button className="flex-1 bg-slate-900 border border-slate-700 text-cyan-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
                <Send size={18} />
                Send USDT
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
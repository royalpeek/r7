'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createPortal } from 'react-dom'
import ResultsPage from '../components/ResultsPage'
import StakingModal from '../components/StakingModal'
import MarketEnded from '../components/MarketEnded'
import PoolHistoryChart from '../components/PoolHistoryChart'
import Timer from '../components/Timer'

type Poll = {
  id: string
  question: string
  yes_votes: number
  no_votes: number
  yes_pool: number
  no_pool: number
  ends_at: string
}

type UserVote = {
  id: string
  poll_id: string
  direction: 'yes' | 'no'
  amount: number
}

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('')
  const [polls, setPolls] = useState<Poll[]>([])
  const [filteredPolls, setFilteredPolls] = useState<Poll[]>([])
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null)
  const [userVote, setUserVote] = useState<UserVote | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showStakingModal, setShowStakingModal] = useState(false)
  const [stakingDirection, setStakingDirection] = useState<'yes' | 'no' | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const WebApp = require('@twa-dev/sdk').default
    const user = WebApp.initDataUnsafe.user
    if (user) setUserId(user.id.toString())
    fetchPolls()
  }, [])

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) { setFilteredPolls([]); return }
    setFilteredPolls(polls.filter(p => p.question.toLowerCase().includes(term)))
  }, [searchTerm, polls])

  const fetchPolls = async () => {
    const { data, error } = await supabase.from('polls').select('*')
    if (!error && data) setPolls(data)
  }

  const fetchUserVote = async (pollId: string, uid: string) => {
    const { data } = await supabase
      .from('votes')
      .select('*')
      .eq('poll_id', pollId)
      .eq('user_id', uid)
      .single()
    setUserVote(data || null)
  }

  const handleSelectPoll = async (poll: Poll) => {
    setSelectedPoll(poll)
    setUserVote(null)
    if (userId) await fetchUserVote(poll.id, userId)
  }

  const handleConfirmVote = async (amount: number) => {
    if (!stakingDirection || !selectedPoll || !userId) return
    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          poll_id: selectedPoll.id,
          direction: stakingDirection,
          amount,
        }),
      })
      if (!response.ok) throw new Error('vote failed')
      await new Promise(resolve => setTimeout(resolve, 1000))
      setShowStakingModal(false)
      setStakingDirection(null)
      await fetchUserVote(selectedPoll.id, userId)
      await fetchPolls()
    } catch (error) {
      console.error('vote error:', error)
      alert('vote failed. try again.')
    }
  }

  const handleBack = () => {
    setSelectedPoll(null)
    setUserVote(null)
    setShowStakingModal(false)
    setStakingDirection(null)
  }

  // --- detail view ---
  if (selectedPoll) {
    const now = new Date()
    const marketEnded = new Date(selectedPoll.ends_at) <= now
    const totalPool = selectedPoll.yes_pool + selectedPoll.no_pool
    const yesPercent = totalPool > 0 ? Math.round((selectedPoll.yes_pool / totalPool) * 100) : 50
    const noPercent = 100 - yesPercent

    // market ended + user voted
    if (marketEnded && userVote) {
      return (
        <MarketEnded
          pollId={selectedPoll.id}
          question={selectedPoll.question}
          userVoteDirection={userVote.direction}
          yesPool={selectedPoll.yes_pool}
          noPool={selectedPoll.no_pool}
          yesVotes={selectedPoll.yes_votes}
          noVotes={selectedPoll.no_votes}
          onBack={handleBack}
        />
      )
    }

    // market ended + user didn't vote
    if (marketEnded && !userVote) {
      return (
        <div className="bg-slate-950 min-h-screen flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <button onClick={handleBack} className="text-slate-400 text-lg">← Back</button>
            <div className="bg-red-900 text-red-400 px-3 py-1 rounded text-sm font-mono">ENDED</div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-24">
            <p className="text-white font-bold text-2xl leading-tight mb-6">{selectedPoll.question}</p>

            <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="text-2xl">🔒</div>
              <div>
                <p className="text-white font-bold">Market Ended</p>
                <p className="text-slate-400 text-sm">you didn't participate in this market</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-slate-400 text-xs mb-2">POOL HISTORY</p>
              <PoolHistoryChart pollId={selectedPoll.id} />
            </div>

            <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="text-2xl">📊</div>
              <div>
                <p className="text-white font-bold">
                  <span className="text-cyan-400">{selectedPoll.yes_votes} YES</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-pink-500">{selectedPoll.no_votes} NO</span>
                </p>
                <p className="text-slate-400 text-sm">${totalPool.toFixed(2)} USDT total volume</p>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-cyan-400 font-bold text-2xl">${selectedPoll.yes_pool.toFixed(2)}</p>
                <p className="text-cyan-400 text-xs mt-1">YES Pool</p>
                <p className="text-slate-400 text-xs mt-2">{yesPercent}%</p>
              </div>
              <div className="flex-1 bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-pink-500 font-bold text-2xl">${selectedPoll.no_pool.toFixed(2)}</p>
                <p className="text-pink-500 text-xs mt-1">NO Pool</p>
                <p className="text-slate-400 text-xs mt-2">{noPercent}%</p>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 mb-6">
              <p className="text-slate-400 text-xs mb-2">FINAL OUTCOME</p>
              <div className="flex items-center gap-3">
                <div className="text-2xl">🏁</div>
                <div>
                  <p className="text-white font-bold">
                    {selectedPoll.no_votes > selectedPoll.yes_votes ? 'NO Won' : selectedPoll.yes_votes > selectedPoll.no_votes ? 'YES Won' : "It's a Tie"}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {selectedPoll.no_votes > selectedPoll.yes_votes ? 'NO' : selectedPoll.yes_votes > selectedPoll.no_votes ? 'YES' : 'Both sides'} had more voters
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // active + user voted
    if (!marketEnded && userVote) {
      return (
        <>
          <ResultsPage
            pollId={selectedPoll.id}
            question={selectedPoll.question}
            voteDirection={userVote.direction === 'yes' ? 'YES' : 'NO'}
            amount={userVote.amount}
            yesPercent={yesPercent}
            noPercent={noPercent}
            yesPool={selectedPoll.yes_pool}
            noPool={selectedPoll.no_pool}
            marketEnded={marketEnded}
            onBack={handleBack}
            onAddMore={() => { setStakingDirection(userVote.direction); setShowStakingModal(true) }}
            onChangeVote={() => { setStakingDirection(userVote.direction === 'yes' ? 'no' : 'yes'); setShowStakingModal(true) }}
          />
          {showStakingModal && stakingDirection && typeof document !== 'undefined' &&
            createPortal(
              <StakingModal
                question={selectedPoll.question}
                voteDirection={stakingDirection === 'yes' ? 'YES' : 'NO'}
                onConfirm={handleConfirmVote}
                onCancel={() => { setShowStakingModal(false); setStakingDirection(null) }}
              />,
              document.body
            )}
        </>
      )
    }

    // active + user hasn't voted
    return (
      <>
        <div className="bg-slate-950 min-h-screen flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <button onClick={handleBack} className="text-slate-400 text-lg">← Back</button>
            <Timer endsAt={selectedPoll.ends_at} />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-32">
            <p className="text-white font-bold text-2xl leading-tight mb-6">{selectedPoll.question}</p>

            <div className="bg-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-48 mb-6">
              <div className="text-5xl mb-3">🗳️</div>
              <p className="text-white font-bold mb-2">vote to unlock insights</p>
              <p className="text-slate-400 text-sm text-center">tap the buttons below to cast your vote. charts, odds, and pool data will appear after you vote.</p>
            </div>

            <p className="text-slate-600 text-xs text-center">1% fee · 24h consensus · no gas</p>
          </div>

          <div className="p-4 pb-8">
            <div className="flex gap-3">
              <button
                onClick={() => { setStakingDirection('no'); setShowStakingModal(true) }}
                className="flex-1 bg-pink-500 text-black font-bold py-4 rounded-2xl"
              >
                STAKE NO
              </button>
              <button
                onClick={() => { setStakingDirection('yes'); setShowStakingModal(true) }}
                className="flex-1 bg-cyan-400 text-black font-bold py-4 rounded-2xl"
              >
                STAKE YES
              </button>
            </div>
          </div>
        </div>

        {showStakingModal && stakingDirection && typeof document !== 'undefined' &&
          createPortal(
            <StakingModal
              question={selectedPoll.question}
              voteDirection={stakingDirection === 'yes' ? 'YES' : 'NO'}
              onConfirm={handleConfirmVote}
              onCancel={() => { setShowStakingModal(false); setStakingDirection(null) }}
            />,
            document.body
          )}
      </>
    )
  }

  // --- search list view ---
  return (
    <div className="bg-slate-950 min-h-screen p-4 pb-24">
      <div className="mb-6">
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 gap-3">
          <span className="text-slate-500">🔍</span>
          <input
            type="text"
            placeholder="search polls..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredPolls.length === 0 && searchTerm.trim() !== '' && (
          <p className="text-slate-500 text-center mt-8">no polls found</p>
        )}

        {filteredPolls.map(poll => {
          const ended = new Date(poll.ends_at) <= new Date()
          const total = poll.yes_pool + poll.no_pool
          const yp = total > 0 ? Math.round((poll.yes_pool / total) * 100) : 50
          const np = 100 - yp

          return (
            <div
              key={poll.id}
              onClick={() => handleSelectPoll(poll)}
              className="bg-slate-900 p-4 rounded-2xl border border-slate-700 cursor-pointer active:opacity-80"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${ended ? 'bg-slate-500' : 'bg-cyan-400'}`} />
                  <span className={`text-xs ${ended ? 'text-slate-500' : 'text-cyan-400'}`}>
                    {ended ? 'Ended' : 'Active'}
                  </span>
                </div>
                <span className="text-slate-500 text-xs">${total.toFixed(2)} vol</span>
              </div>

              <p className="text-white font-bold mb-3">{poll.question}</p>

              <div className="space-y-2">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${yp}%` }} />
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-pink-500 rounded-full" style={{ width: `${np}%` }} />
                </div>
              </div>

              <div className="flex justify-between mt-2">
                <span className="text-cyan-400 text-xs font-bold">{yp}% Yes</span>
                <span className="text-pink-500 text-xs font-bold">{np}% No</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
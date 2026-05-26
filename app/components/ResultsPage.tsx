'use client'

import { useEffect, useState } from 'react'
import PoolHistoryChart from './PoolHistoryChart'
import Timer from './Timer'

interface ResultsPageProps {
  question: string
  pollId: string
  voteDirection: 'YES' | 'NO'
  amount: number
  yesPercent: number
  noPercent: number
  yesPool: number
  noPool: number
  endsAt: string
  marketEnded?: boolean
  onBack: () => void
  onAddMore: () => void
  onChangeVote: () => void
}

export default function ResultsPage({
  question,
  pollId,
  voteDirection,
  amount,
  yesPercent,
  noPercent,
  yesPool,
  noPool,
  endsAt,
  marketEnded = false,
  onBack,
  onAddMore,
  onChangeVote,
}: ResultsPageProps) {
  const [stakerCount, setStakerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStakers = async () => {
      try {
        const response = await fetch(`/api/polls/${pollId}/stats`)
        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'failed to fetch poll stats')
        setStakerCount(data.stakerCount || 0)
      } catch (err) {
        console.error('fetch stakers error:', err)
        setStakerCount(0)
      } finally {
        setLoading(false)
      }
    }

    fetchStakers()
  }, [pollId])

  const totalVolume = yesPool + noPool

  return (
    <div className="fixed inset-0 bg-slate-950 z-40 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white text-xl"
            >
              ← Back
            </button>
            <Timer endsAt={endsAt} />
          </div>

          <div className="bg-slate-800 rounded-xl p-6 mb-8">
            <p className={`text-sm font-bold mb-2 ${voteDirection === 'YES' ? 'text-cyan-400' : 'text-pink-500'}`}>
              You voted {voteDirection}
            </p>
            <p className="text-slate-400 text-sm mb-4">${amount.toFixed(2)} USDT staked</p>
            <h2 className="text-white font-bold text-xl mb-4">{question}</h2>

            <div className="space-y-4 mb-6">
              <div className="h-12 bg-slate-700 rounded border border-cyan-500 flex items-center overflow-hidden">
                <div
                  className="h-full bg-cyan-500 flex items-center justify-end pr-2"
                  style={{ width: `${yesPercent}%` }}
                >
                  <span className="text-black text-xs font-bold">YES</span>
                </div>
              </div>

              <div className="h-12 bg-slate-700 rounded border border-pink-500 flex items-center overflow-hidden">
                <div
                  className="h-full bg-pink-500 flex items-center justify-end pr-2"
                  style={{ width: `${noPercent}%` }}
                >
                  <span className="text-black text-xs font-bold">NO</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between text-lg font-bold mb-4">
              <div className="text-center">
                <p className="text-cyan-400">YES {yesPercent}%</p>
                <p className="text-cyan-400 text-sm">${yesPool.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-pink-500">NO {noPercent}%</p>
                <p className="text-pink-500 text-sm">${noPool.toFixed(2)}</p>
              </div>
            </div>

            <p className="text-slate-400 text-xs">← swipe to add or change →</p>
          </div>

          <div className="mb-8">
            <p className="text-slate-400 text-xs mb-2">POOL HISTORY</p>
            <PoolHistoryChart pollId={pollId} />
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-white font-bold">
                  {loading ? 'loading...' : `${stakerCount} ${stakerCount === 1 ? 'person' : 'people'} staking`}
                </p>
                <p className="text-slate-400 text-sm">${totalVolume.toFixed(2)} USDT total volume</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 pb-8 bg-slate-950">
        <div className="flex gap-3 max-w-sm mx-auto">
          <button
            onClick={onAddMore}
            disabled={marketEnded}
            className={`flex-1 text-black font-bold py-4 rounded-2xl ${
              voteDirection === 'YES' ? 'bg-cyan-400 hover:bg-cyan-500' : 'bg-pink-500 hover:bg-pink-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            ADD {voteDirection}
          </button>
          <button
            onClick={onChangeVote}
            disabled={marketEnded}
            className={`flex-1 text-black font-bold py-4 rounded-2xl ${
              voteDirection === 'YES' ? 'bg-pink-500 hover:bg-pink-600' : 'bg-cyan-400 hover:bg-cyan-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            CHANGE {voteDirection === 'YES' ? 'NO' : 'YES'}
          </button>
        </div>
      </div>
    </div>
  )
}

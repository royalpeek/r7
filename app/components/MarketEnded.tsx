'use client'

import PoolHistoryChart from './PoolHistoryChart'

interface MarketEndedProps {
  pollId: string
  question: string
  userVoteDirection: 'yes' | 'no'
  yesPool: number
  noPool: number
  yesVotes: number
  noVotes: number
  onBack: () => void
}

export default function MarketEnded({
  pollId,
  question,
  userVoteDirection,
  yesPool,
  noPool,
  yesVotes,
  noVotes,
  onBack,
}: MarketEndedProps) {
  const totalVolume = yesPool + noPool
  const yesPercent = totalVolume > 0 ? Math.round((yesPool / totalVolume) * 100) : 0
  const noPercent = 100 - yesPercent

  return (
    <div className="h-full w-full bg-slate-950 flex flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-slate-400 text-lg"
        >
          ← Back
        </button>
        <div className="bg-red-900 text-red-400 px-3 py-1 rounded text-sm font-mono">
          ENDED
        </div>
      </div>

      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {/* question */}
        <p className="text-white font-bold text-2xl leading-tight mb-6">{question}</p>

        {/* your vote */}
        <p className={`text-sm font-bold mb-4 ${userVoteDirection === 'yes' ? 'text-cyan-400' : 'text-pink-500'}`}>
          You voted {userVoteDirection === 'yes' ? 'YES' : 'NO'}
        </p>

        {/* vote counts and engagement */}
        <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="text-2xl">📊</div>
          <div>
            <p className="text-white font-bold">
              <span className="text-cyan-400">{yesVotes} YES</span>
              <span className="text-slate-400"> · </span>
              <span className="text-pink-500">{noVotes} NO</span>
            </p>
            <p className="text-slate-400 text-sm">${totalVolume.toFixed(2)} USDT total volume</p>
          </div>
        </div>

        {/* final price chart */}
        <div className="mb-6">
          <p className="text-slate-400 text-xs mb-2">POOL HISTORY</p>
          <PoolHistoryChart pollId={pollId} />
        </div>

        {/* pool breakdown */}
        <div className="mb-6">
          <p className="text-slate-400 text-xs mb-3">POOL BREAKDOWN</p>
          <div className="flex gap-4">
            <div className="flex-1 bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-cyan-400 font-bold text-2xl">${yesPool.toFixed(2)}</p>
              <p className="text-cyan-400 text-xs mt-1">YES Pool</p>
              <p className="text-slate-400 text-xs mt-2">{yesPercent}%</p>
            </div>
            <div className="flex-1 bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-pink-500 font-bold text-2xl">${noPool.toFixed(2)}</p>
              <p className="text-pink-500 text-xs mt-1">NO Pool</p>
              <p className="text-slate-400 text-xs mt-2">{noPercent}%</p>
            </div>
          </div>
        </div>

        {/* final outcome */}
        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-xs mb-2">FINAL OUTCOME</p>
          <div className="flex items-center gap-3">
            <div className="text-2xl">🏁</div>
            <div>
              <p className="text-white font-bold">
                {noVotes > yesVotes ? 'NO Won' : yesVotes > noVotes ? 'YES Won' : 'It\'s a Draw'}
              </p>
              <p className="text-slate-400 text-sm">
                {noVotes > yesVotes ? 'NO' : yesVotes > noVotes ? 'YES' : 'Both sides'} had more voters
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

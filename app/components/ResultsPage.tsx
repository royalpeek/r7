'use client'

interface ResultsPageProps {
  question: string
  voteDirection: 'YES' | 'NO'
  amount: number
  yesPercent: number
  noPercent: number
  onBack: () => void
  onAddMore: () => void
  onChangeVote: () => void
}

export default function ResultsPage({
  question,
  voteDirection,
  amount,
  yesPercent,
  noPercent,
  onBack,
  onAddMore,
  onChangeVote,
}: ResultsPageProps) {
  return (
    <div className="fixed inset-0 bg-slate-950 z-40 flex flex-col">
      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white text-xl"
            >
              ← Back
            </button>
            <div className="text-cyan-400 bg-cyan-900 px-3 py-1 rounded text-sm font-mono">
              00:04:31
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 mb-8">
            <p className={`text-sm font-bold mb-2 ${voteDirection === 'YES' ? 'text-cyan-400' : 'text-pink-500'}`}>
              You voted {voteDirection}
            </p>
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
              <span className="text-cyan-400">YES {yesPercent}%</span>
              <span className="text-pink-500">NO {noPercent}%</span>
            </div>

            <p className="text-slate-400 text-xs">← swipe to add or change →</p>
          </div>

          <div className="mb-8">
            <p className="text-slate-400 text-xs mb-2">PRICE · 24H</p>
            <div className="bg-slate-800 rounded-xl p-4 h-48 flex items-center justify-center">
              <p className="text-slate-500">Chart placeholder</p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-white font-bold">232 people staking</p>
                <p className="text-slate-400 text-sm">$1,652 USDC total volume</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* buttons pinned to bottom, not floating */}
      <div className="p-4 pb-8 bg-slate-950">
        <div className="flex gap-3 max-w-sm mx-auto">
          <button
            onClick={onAddMore}
            className={`flex-1 text-black font-bold py-4 rounded-2xl ${
              voteDirection === 'YES' ? 'bg-cyan-400 hover:bg-cyan-500' : 'bg-pink-500 hover:bg-pink-600'
            }`}
          >
            ADD {voteDirection}
          </button>
          <button
            onClick={onChangeVote}
            className={`flex-1 text-black font-bold py-4 rounded-2xl ${
              voteDirection === 'YES' ? 'bg-pink-500 hover:bg-pink-600' : 'bg-cyan-400 hover:bg-cyan-500'
            }`}
          >
            CHANGE {voteDirection === 'YES' ? 'NO' : 'YES'}
          </button>
        </div>
      </div>
    </div>
  )
}
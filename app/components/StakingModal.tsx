'use client'

import { useState } from 'react'

interface StakingModalProps {
  question: string
  voteDirection: 'YES' | 'NO'
  onConfirm: (amount: number) => void
  onCancel: () => void
}

export default function StakingModal({ question, voteDirection, onConfirm, onCancel }: StakingModalProps) {
  const [amount, setAmount] = useState(5)
  const predefinedAmounts = [5, 10, 50, 100, 500]
  const fee = amount * 0.01
  const total = amount + fee
  const estimatedPayout = (amount * 0.95).toFixed(2)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-sm border border-slate-700">
        <div className="mb-6">
          <p className="text-cyan-400 text-sm font-bold mb-2">STAKE {voteDirection}</p>
          <h2 className="text-white font-bold text-lg">{question}</h2>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <span className="text-5xl font-bold text-cyan-400">${amount}</span>
            <span className="text-slate-400 ml-2">USDC</span>
          </div>

          <input
            type="range"
            min="1"
            max="1000"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {predefinedAmounts.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`py-2 rounded-lg font-bold transition ${
                amount === preset
                  ? 'bg-cyan-400 text-black'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-6 p-4 bg-slate-800 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Fee: 1%</span>
            <span className="text-slate-300">${fee.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span className="text-white">Est. payout if {voteDirection}</span>
            <span className="text-cyan-400">${estimatedPayout} USDC</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-700">
            <span className="text-white">Total cost</span>
            <span className="text-white">${total.toFixed(2)} USDC</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-lg border border-slate-700 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(amount)}
            className={`flex-1 font-bold py-3 rounded-lg text-black ${
              voteDirection === 'YES'
                ? 'bg-cyan-400 hover:bg-cyan-500'
                : 'bg-pink-400 hover:bg-pink-500'
            }`}
          >
            Confirm {voteDirection} · ${total.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  )
}
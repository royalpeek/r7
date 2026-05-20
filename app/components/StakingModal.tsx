'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'

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
  const isYes = voteDirection === 'YES'
  const buttonColor = isYes ? 'bg-cyan-400' : 'bg-pink-500'
  const textColor = isYes ? 'text-cyan-400' : 'text-pink-500'

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onCancel}></div>
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl p-6 border-t border-slate-700 z-50 max-h-[90vh] overflow-y-auto">
        <div className="max-w-sm mx-auto">
          <div className="mb-6">
            <p className={`text-sm font-bold mb-2 ${textColor}`}>
              STAKE {voteDirection}
            </p>
            <h2 className="text-white font-bold text-xl">{question}</h2>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-center mb-4">
              <span className={`text-5xl font-bold ${textColor}`}>${amount}</span>
              <span className="text-slate-400 ml-2">USDC</span>
            </div>

            <input
              type="range"
              min="1"
              max="1000"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: isYes ? '#06b6d4' : '#ec4899',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {predefinedAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`py-2 rounded-lg font-bold transition ${
                  amount === preset
                    ? `${buttonColor} text-black`
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
              <span className={textColor}>${estimatedPayout} USDC</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-3 border-t border-slate-700">
              <span className="text-white">Total cost</span>
              <span className="text-white">${total.toFixed(2)} USDC</span>
            </div>
          </div>

          <div className="flex gap-3 pb-4">
            <button
              onClick={onCancel}
              className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-lg border border-slate-700 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(amount)}
              className={`flex-1 ${buttonColor} text-black font-bold py-3 rounded-lg hover:opacity-90`}
            >
              Confirm {voteDirection} · ${total.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </>
  )

  if (typeof document === 'undefined') return null

  return createPortal(modalContent, document.body)
}
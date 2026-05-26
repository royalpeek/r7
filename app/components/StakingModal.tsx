'use client'

import { useEffect, useState } from 'react'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'

interface StakingModalProps {
  question: string
  voteDirection: 'YES' | 'NO'
  onConfirm: (amount: number) => void
  onCancel: () => void
}

export default function StakingModal({ question, voteDirection, onConfirm, onCancel }: StakingModalProps) {
  const haptics = useHapticFeedback()
  const [amount, setAmount] = useState(5)
  const [vh, setVh] = useState(0)

  const predefinedAmounts = [5, 10, 50, 100, 500]
  const fee = amount * 0.01
  const total = amount + fee
  const estimatedPayout = (amount * 0.95).toFixed(2)
  const isYes = voteDirection === 'YES'
  const buttonColor = isYes ? 'bg-cyan-400' : 'bg-pink-500'
  const textColor = isYes ? 'text-cyan-400' : 'text-pink-500'

  useEffect(() => {
    const update = () => setVh(window.visualViewport?.height || window.innerHeight)
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)

    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div
        className="absolute left-0 right-0 bg-slate-900 rounded-t-3xl p-8 border-t border-slate-700"
        style={{
          bottom: 0,
          height: vh ? `${vh}px` : '100dvh',
          overflowY: 'auto',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-sm mx-auto">
          <div className="mb-8">
            <p className={`text-sm font-bold mb-3 ${textColor}`}>STAKE {voteDirection}</p>
            <h2 className="text-white font-bold text-2xl">{question}</h2>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-center mb-6">
              <span className={`text-6xl font-bold ${textColor}`}>${amount}</span>
              <span className="text-slate-400 ml-3">USDT</span>
            </div>

            <input
              type="range"
              min="1"
              max="1000"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: isYes ? '#06b6d4' : '#ec4899',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mb-8">
            {predefinedAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  haptics.selection()
                  setAmount(preset)
                }}
                className={`py-3 rounded-lg font-bold text-sm transition ${
                  amount === preset
                    ? `${buttonColor} text-black`
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>

          <div className="space-y-4 mb-8 p-4 bg-slate-800 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Fee: 1%</span>
              <span className="text-slate-300">${fee.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-white">Est. payout if {voteDirection}</span>
              <span className={textColor}>${estimatedPayout} USDT</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-4 border-t border-slate-700">
              <span className="text-white">Total cost</span>
              <span className="text-white">${total.toFixed(2)} USDT</span>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => {
                haptics.selection()
                onCancel()
              }}
              className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-lg border border-slate-700 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                haptics.impact('medium')
                onConfirm(amount)
              }}
              className={`flex-1 ${buttonColor} text-black font-bold py-3 rounded-lg hover:opacity-90`}
            >
              Confirm {voteDirection} · ${total.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

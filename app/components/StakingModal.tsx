'use client'

import { useEffect, useState } from 'react'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { calculatePayoutBreakdown } from '@/lib/payouts'

interface StakingModalProps {
  question: string
  voteDirection: 'YES' | 'NO'
  availableBalance?: number
  replacementCredit?: number
  yesPool?: number
  noPool?: number
  existingVoteDirection?: 'yes' | 'no' | null
  existingVoteAmount?: number
  mode?: 'new' | 'add' | 'change'
  onConfirm: (amount: number) => void
  onCancel: () => void
}

export default function StakingModal({
  question,
  voteDirection,
  availableBalance = 0,
  replacementCredit = 0,
  yesPool = 0,
  noPool = 0,
  existingVoteDirection = null,
  existingVoteAmount = 0,
  mode = 'new',
  onConfirm,
  onCancel,
}: StakingModalProps) {
  const haptics = useHapticFeedback()
  const [amount, setAmount] = useState(5)
  const [vh, setVh] = useState(0)

  const predefinedAmounts = [5, 10, 50, 100, 500]
  const fee = amount * 0.01
  const total = amount + fee
  const safeReplacementCredit = Math.max(0, replacementCredit)
  const selectedDirection = voteDirection.toLowerCase() as 'yes' | 'no'
  const safeExistingVoteAmount = Math.max(0, existingVoteAmount)
  let estimatedYesPool = Math.max(0, yesPool)
  let estimatedNoPool = Math.max(0, noPool)
  let estimatedVoteAmount = amount

  if (existingVoteDirection && safeExistingVoteAmount > 0) {
    const isChangingSide = mode === 'change' || existingVoteDirection !== selectedDirection

    if (isChangingSide) {
      if (existingVoteDirection === 'yes') {
        estimatedYesPool = Math.max(0, estimatedYesPool - safeExistingVoteAmount)
      } else {
        estimatedNoPool = Math.max(0, estimatedNoPool - safeExistingVoteAmount)
      }
    } else {
      estimatedVoteAmount = safeExistingVoteAmount + amount
    }
  }

  if (selectedDirection === 'yes') {
    estimatedYesPool += amount
  } else {
    estimatedNoPool += amount
  }

  const estimatedPayout = calculatePayoutBreakdown({
    voteAmount: estimatedVoteAmount,
    voteDirection: selectedDirection,
    winningDirection: selectedDirection,
    yesPool: estimatedYesPool,
    noPool: estimatedNoPool,
  }).claimablePayout.toFixed(2)
  const amountNeededFromBalance = Math.max(0, total - safeReplacementCredit)
  const walletChange = safeReplacementCredit - total
  const hasEnoughBalance = amountNeededFromBalance <= availableBalance
  const isYes = voteDirection === 'YES'
  const buttonColor = isYes ? 'bg-cyan-400' : 'bg-pink-500'
  const textColor = isYes ? 'text-cyan-400' : 'text-pink-500'
  const maxStake = Math.max(1, Math.floor(availableBalance + safeReplacementCredit))

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
    <div className="fixed inset-0 z-[80] bg-black/40">
      <div
        className="absolute left-0 right-0 flex flex-col bg-slate-900 rounded-t-3xl border-t border-slate-700"
        style={{
          bottom: 0,
          height: vh ? `${vh}px` : '100dvh',
        }}
      >
        <div className="flex-1 overflow-y-auto px-8 pt-8 pb-5">
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
            <p className="text-center text-slate-400 text-sm mb-6">
              Available: ${availableBalance.toFixed(2)} USDT
            </p>

            <input
              type="range"
              min="1"
              max={maxStake}
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

          {safeReplacementCredit > 0 && (
            <div className="mb-4 rounded-2xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Previous stake</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-200">Returned before this stake</span>
                <span className="shrink-0 text-base font-bold text-cyan-200">${safeReplacementCredit.toFixed(2)} USDT</span>
              </div>
            </div>
          )}

          <div className="space-y-4 mb-8 p-4 bg-slate-800 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Fee: 1%</span>
              <span className="text-slate-300">${fee.toFixed(2)} USDT</span>
            </div>
            {safeReplacementCredit > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Old stake returned</span>
                <span className="text-cyan-300">${safeReplacementCredit.toFixed(2)} USDT</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold">
              <span className="text-white">Est. payout if {voteDirection} wins</span>
              <span className={textColor}>${estimatedPayout} USDT</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-4 border-t border-slate-700">
              <span className="text-white">{walletChange >= 0 ? 'Wallet receives' : 'Needed from balance'}</span>
              <span className={walletChange >= 0 ? 'text-cyan-300' : 'text-white'}>
                ${Math.abs(walletChange).toFixed(2)} USDT
              </span>
            </div>
          </div>

          </div>
        </div>
        <div className="shrink-0 border-t border-slate-800 bg-slate-900/95 px-8 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-sm mx-auto">
            <div className="flex gap-3">
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
                disabled={!hasEnoughBalance}
                onClick={() => {
                  haptics.impact('medium')
                  onConfirm(amount)
                }}
                className={`flex-1 ${buttonColor} text-black font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {hasEnoughBalance ? `Confirm ${voteDirection}` : 'Insufficient balance'}
              </button>
            </div>

            {!hasEnoughBalance && (
              <p className="mt-3 text-center text-xs text-pink-300">
                You need ${amountNeededFromBalance.toFixed(2)} USDT after using your old stake. Available balance is ${availableBalance.toFixed(2)} USDT.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

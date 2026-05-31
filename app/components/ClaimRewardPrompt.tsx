'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Gift, X } from 'lucide-react'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { ClaimablePosition, getClaimablePositions, getPositionClaimBreakdown } from '@/lib/positionClaims'
import { formatTradingAsset } from '@/lib/tradingAsset'

export default function ClaimRewardPrompt() {
  const haptics = useHapticFeedback()
  const router = useRouter()
  const pathname = usePathname()
  const { userId, initData, loading } = useTelegramUser()
  const [claimablePositions, setClaimablePositions] = useState<ClaimablePosition[]>([])
  const [dismissedRewardCount, setDismissedRewardCount] = useState(0)

  const fetchClaimablePositions = useCallback(async () => {
    try {
      if (!userId || (!initData && process.env.NODE_ENV === 'production')) return

      const response = await fetch('/api/me/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to load rewards')
      setClaimablePositions(getClaimablePositions((data.positions || []) as ClaimablePosition[]))
    } catch (error) {
      console.error('claim reward prompt error:', error)
    }
  }, [initData, userId])

  useEffect(() => {
    if (loading) return

    const timeout = window.setTimeout(() => {
      fetchClaimablePositions()
    }, 800)
    const interval = window.setInterval(fetchClaimablePositions, 60_000)

    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [fetchClaimablePositions, loading])

  if (
    pathname === '/porfolio-page' ||
    claimablePositions.length === 0 ||
    dismissedRewardCount === claimablePositions.length
  ) return null

  const totalClaimable = claimablePositions.reduce((sum, position) => {
    return sum + getPositionClaimBreakdown(position).claimablePayout
  }, 0)

  return (
    <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-md">
      <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/95 p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cyan-400 text-black">
            <Gift size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white">Reward ready</p>
            <p className="mt-1 text-sm text-slate-400">
              {formatTradingAsset(totalClaimable)} available from {claimablePositions.length} ended market{claimablePositions.length === 1 ? '' : 's'}.
            </p>
            <p className="mt-1 text-xs text-slate-500">Open Portfolio to review each reward before claiming.</p>
            <button
              onClick={() => {
                haptics.impact('medium')
                router.push('/porfolio-page?claim=1')
              }}
              className="mt-3 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-black active:scale-95 transition"
            >
              Claim reward
            </button>
          </div>
          <button
            onClick={() => {
              haptics.selection()
              setDismissedRewardCount(claimablePositions.length)
            }}
            className="rounded-full p-1 text-slate-500 active:scale-95 transition"
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

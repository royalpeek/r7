import { getMarketLifecycleStatus } from '@/lib/marketLifecycle'
import { calculatePayoutBreakdown, getWinningDirection } from '@/lib/payouts'

export type ClaimablePosition = {
  id: string
  poll_id: string
  question: string
  direction: 'yes' | 'no'
  amount: number
  status?: string | null
  ends_at: string
  yes_pool: number
  no_pool: number
  yes_votes: number
  no_votes: number
  claimed_at?: string | null
  payout_amount?: number | null
}

export function getPositionClaimBreakdown(position: ClaimablePosition) {
  const winner = getWinningDirection(Number(position.yes_votes || 0), Number(position.no_votes || 0))
  const userWon = winner === 'draw' || winner === position.direction
  const lifecycleStatus = getMarketLifecycleStatus(position.status, position.ends_at)
  const breakdown = calculatePayoutBreakdown({
    voteAmount: Number(position.amount || 0),
    voteDirection: position.direction,
    winningDirection: winner,
    yesPool: Number(position.yes_pool || 0),
    noPool: Number(position.no_pool || 0),
  })

  return {
    winner,
    userWon,
    lifecycleStatus,
    claimablePayout: breakdown.claimablePayout,
  }
}

export function isClaimablePosition(position: ClaimablePosition) {
  const breakdown = getPositionClaimBreakdown(position)
  const marketEnded = breakdown.lifecycleStatus === 'ended' || breakdown.lifecycleStatus === 'closed'

  return (
    marketEnded &&
    breakdown.userWon &&
    !position.claimed_at &&
    breakdown.claimablePayout > 0
  )
}

export function getClaimablePositions(positions: ClaimablePosition[]) {
  return positions.filter(isClaimablePosition)
}

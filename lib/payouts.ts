export type WinningDirection = 'yes' | 'no' | 'draw'

export const CREATOR_WINNING_POOL_CUT = 0.0025
export const CREATOR_LOSING_POOL_CUT = 0.005

export function getWinningDirection(yesVotes: number, noVotes: number): WinningDirection {
  if (yesVotes > noVotes) return 'yes'
  if (noVotes > yesVotes) return 'no'
  return 'draw'
}

export function calculateCreatorReward(
  winningDirection: WinningDirection,
  yesPool: number,
  noPool: number
) {
  if (winningDirection === 'draw') return 0

  const winningPool = winningDirection === 'yes' ? yesPool : noPool
  const losingPool = winningDirection === 'yes' ? noPool : yesPool
  return Number(((winningPool * CREATOR_WINNING_POOL_CUT) + (losingPool * CREATOR_LOSING_POOL_CUT)).toFixed(2))
}

export function calculateClaimPayout({
  voteAmount,
  voteDirection,
  winningDirection,
  yesPool,
  noPool,
}: {
  voteAmount: number
  voteDirection: 'yes' | 'no'
  winningDirection: WinningDirection
  yesPool: number
  noPool: number
}) {
  return calculatePayoutBreakdown({
    voteAmount,
    voteDirection,
    winningDirection,
    yesPool,
    noPool,
  }).claimablePayout
}

export function calculatePayoutBreakdown({
  voteAmount,
  voteDirection,
  winningDirection,
  yesPool,
  noPool,
}: {
  voteAmount: number
  voteDirection: 'yes' | 'no'
  winningDirection: WinningDirection
  yesPool: number
  noPool: number
}) {
  if (winningDirection === 'draw') {
    return {
      grossPayout: Number(voteAmount.toFixed(2)),
      creatorReward: 0,
      creatorRewardShare: 0,
      claimablePayout: Number(voteAmount.toFixed(2)),
    }
  }

  if (voteDirection !== winningDirection) {
    return {
      grossPayout: 0,
      creatorReward: calculateCreatorReward(winningDirection, yesPool, noPool),
      creatorRewardShare: 0,
      claimablePayout: 0,
    }
  }

  const winningPool = winningDirection === 'yes' ? yesPool : noPool
  const totalPool = yesPool + noPool
  const creatorReward = calculateCreatorReward(winningDirection, yesPool, noPool)
  const claimablePool = Math.max(0, totalPool - creatorReward)

  if (winningPool <= 0) {
    return {
      grossPayout: 0,
      creatorReward,
      creatorRewardShare: 0,
      claimablePayout: 0,
    }
  }

  const stakeShare = voteAmount / winningPool
  const grossPayout = Number((stakeShare * totalPool).toFixed(2))
  const creatorRewardShare = Number((stakeShare * creatorReward).toFixed(2))
  const claimablePayout = Number((stakeShare * claimablePool).toFixed(2))

  return {
    grossPayout,
    creatorReward,
    creatorRewardShare,
    claimablePayout,
  }
}

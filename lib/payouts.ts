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
  if (winningDirection === 'draw') return Number(voteAmount.toFixed(2))
  if (voteDirection !== winningDirection) return 0

  const winningPool = winningDirection === 'yes' ? yesPool : noPool
  const creatorReward = calculateCreatorReward(winningDirection, yesPool, noPool)
  const claimablePool = Math.max(0, yesPool + noPool - creatorReward)

  if (winningPool <= 0) return 0
  return Number(((voteAmount / winningPool) * claimablePool).toFixed(2))
}

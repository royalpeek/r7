import type { SupabaseClient } from '@supabase/supabase-js'

export type TransactionType =
  | 'test_credit'
  | 'ton_deposit'
  | 'ton_withdrawal'
  | 'stake'
  | 'fee'
  | 'claim_payout'
  | 'creator_reward'

export async function recordTransaction(
  supabase: SupabaseClient,
  {
    userId,
    type,
    amount,
    balanceAfter,
    pollId,
    description,
    status = 'confirmed',
    txHash,
  }: {
    userId: string
    type: TransactionType
    amount: number
    balanceAfter?: number
    pollId?: string
    description: string
    status?: 'pending' | 'confirmed' | 'failed'
    txHash?: string
  }
) {
  const payload = {
    user_id: userId,
    type,
    amount,
    balance_after: typeof balanceAfter === 'number' ? balanceAfter : null,
    poll_id: pollId || null,
    description,
    status,
    tx_hash: txHash || null,
  }

  const { error } = await supabase
    .from('user_transactions')
    .insert(payload)

  if (error) {
    if (error.message.includes('status') || error.message.includes('tx_hash')) {
      const { error: fallbackError } = await supabase
        .from('user_transactions')
        .insert({
          user_id: userId,
          type,
          amount,
          balance_after: typeof balanceAfter === 'number' ? balanceAfter : null,
          poll_id: pollId || null,
          description,
        })

      if (!fallbackError) return
    }

    console.error('transaction ledger insert error:', error)
  }
}

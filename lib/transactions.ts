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
  }: {
    userId: string
    type: TransactionType
    amount: number
    balanceAfter?: number
    pollId?: string
    description: string
  }
) {
  const { error } = await supabase
    .from('user_transactions')
    .insert({
      user_id: userId,
      type,
      amount,
      balance_after: typeof balanceAfter === 'number' ? balanceAfter : null,
      poll_id: pollId || null,
      description,
    })

  if (error) {
    console.error('transaction ledger insert error:', error)
  }
}

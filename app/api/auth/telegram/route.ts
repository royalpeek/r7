import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { recordTransaction } from '@/lib/transactions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData } = body
    const telegramUser = getRequestTelegramUser(initData)
    const userId = String(telegramUser.id)
    const username = telegramUser.username || telegramUser.first_name || 'user'
    const supabase = getSupabaseAdmin()

    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') throw checkError

    if (!existingUser) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          username,
          balance: 100,
          is_creator: false,
        })
        .select()
        .single()

      if (error) throw error
      await recordTransaction(supabase, {
        userId,
        type: 'test_credit',
        amount: 100,
        balanceAfter: 100,
        description: 'Test wallet credit',
      })
      return NextResponse.json({ user: data })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ username })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 })
  }
}

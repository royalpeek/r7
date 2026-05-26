import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getRequestTelegramUser } from '@/lib/telegramAuth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData } = body
    const telegramUser = getRequestTelegramUser(initData)
    const userId = String(telegramUser.id)
    const username = telegramUser.username || telegramUser.first_name || 'user'

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
          is_creator: false,
        })
        .select()
        .single()

      if (error) throw error
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

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .neq('status', 'paused')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ polls: data })
  } catch (error) {
    console.error('Error fetching polls:', error)
    return NextResponse.json({ error: 'Failed to fetch polls' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const { question, category } = body
    const admin = getSupabaseAdmin()

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const trimmedQuestion = question.trim()
    if (trimmedQuestion.length > 64) {
      return NextResponse.json({ error: 'Question is too long' }, { status: 400 })
    }

    const { data: creator, error: creatorError } = await admin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (creatorError) throw creatorError
    const role = creator?.role || (creator?.is_creator ? 'creator' : 'user')

    if (role !== 'creator' && role !== 'admin') {
      return NextResponse.json({ error: 'Creator access required' }, { status: 403 })
    }

    // set poll to expire 24 hours from now
    const ends_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await admin
      .from('polls')
      .insert({
        question: trimmedQuestion,
        category: category || 'general',
        status: 'active',
        yes_pool: 0,
        no_pool: 0,
        yes_votes: 0,
        no_votes: 0,
        volume: 0,
        ends_at,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ poll: data })
  } catch (error) {
    console.error('Error creating poll:', error)
    return NextResponse.json({ error: 'Failed to create poll' }, { status: 400 })
  }
}

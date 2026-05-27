import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { CREATOR_OPEN_MARKET_LIMIT, getOpenMarketCutoff } from '@/lib/creatorQuota'
import { closeExpiredMarkets } from '@/lib/marketLifecycle'
import { MARKET_DURATION_HOURS, moderateMarketQuestion } from '@/lib/marketModeration'

export async function GET() {
  try {
    await closeExpiredMarkets(getSupabaseAdmin())

    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .neq('status', 'paused')
      .neq('status', 'archived')
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
    const { question } = body
    const admin = getSupabaseAdmin()

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
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

    if (role === 'creator') {
      await closeExpiredMarkets(admin)

      const openMarketCutoff = getOpenMarketCutoff()
      const { count, error: countError } = await admin
        .from('polls')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)
        .in('status', ['active', 'paused'])
        .gt('ends_at', openMarketCutoff)

      if (countError) throw countError

      if ((count ?? 0) >= CREATOR_OPEN_MARKET_LIMIT) {
        return NextResponse.json({ error: 'Open market limit reached' }, { status: 429 })
      }
    }

    const { data: existingMarkets, error: existingMarketsError } = await admin
      .from('polls')
      .select('id, question')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(100)

    if (existingMarketsError) throw existingMarketsError

    const moderation = moderateMarketQuestion({
      question,
      description: String(body.description || ''),
      existingMarkets: existingMarkets || [],
    })

    if (!moderation.approved) {
      return NextResponse.json({
        error: moderation.reasons[0] || 'Market did not pass moderation',
        reasons: moderation.reasons,
        similarMarket: moderation.similarMarket,
      }, { status: 400 })
    }

    const ends_at = new Date(Date.now() + MARKET_DURATION_HOURS * 60 * 60 * 1000).toISOString()

    const { data, error } = await admin
      .from('polls')
      .insert({
        question: moderation.normalizedQuestion,
        category: moderation.category,
        description: String(body.description || '').trim().slice(0, 256) || null,
        status: 'active',
        yes_pool: 0,
        no_pool: 0,
        yes_votes: 0,
        no_votes: 0,
        volume: 0,
        ends_at,
        created_by: userId,
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

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
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
    const { question, category } = body

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // set poll to expire 24 hours from now
    const ends_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('polls')
      .insert({
        question: question.trim(),
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

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { user_id, poll_id, direction, amount } = body

    console.log('vote request:', { user_id, poll_id, direction, amount })

    if (!poll_id || !direction || !amount) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    // ensure poll_id is a valid uuid string
    poll_id = String(poll_id).trim()

    const { data: vote, error } = await supabase
      .from('votes')
      .insert([{ 
        user_id: user_id ? String(user_id).trim() : 'anonymous',
        poll_id,
        direction: String(direction).toLowerCase(),
        amount: Number(amount),
      }])
      .select()

    if (error) {
      console.error('insert error:', error)
      throw error
    }

    return NextResponse.json({ vote: vote[0] })
  } catch (error) {
    console.error('vote error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
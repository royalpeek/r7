import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, first_name, username } = body

    // upsert user in database
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          id: id.toString(),
          username: username || first_name,
        },
        { onConflict: 'id' }
      )
      .select()

    if (error) throw error

    return NextResponse.json({ user: data[0] })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Auth failed' }, { status: 400 })
  }
}
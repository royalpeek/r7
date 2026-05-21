import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
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
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePolls() {
  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPolls()
    
    // subscribe to real-time updates on polls table
    const subscription = supabase
      .channel('polls')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'polls' 
      }, (payload) => {
        console.log('poll update:', payload)
        fetchPolls() // refetch all polls when any change happens
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchPolls = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPolls(data || [])
    } catch (err) {
      setError((err as any).message)
    } finally {
      setLoading(false)
    }
  }

  return { polls, loading, error, refetch: fetchPolls }
}
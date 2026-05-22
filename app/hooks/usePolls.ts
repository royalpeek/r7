import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePolls() {
  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPolls()

    // refetch polls every 1 second for real-time feel
    const interval = setInterval(() => {
      fetchPolls()
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const fetchPolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPolls(data || [])
      setLoading(false)
    } catch (err) {
      setError((err as any).message)
      setLoading(false)
    }
  }

  return { polls, loading, error, refetch: fetchPolls }
}
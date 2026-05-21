import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePolls() {
  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPolls()
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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { polls, loading, error, refetch: fetchPolls }
}
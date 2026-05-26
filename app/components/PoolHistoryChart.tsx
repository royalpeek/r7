'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface HistoryData {
  created_at: string
  yes_pool: number
  no_pool: number
}

type PoolHistoryChartProps = {
  pollId: string
  yesPool?: number
  noPool?: number
}

export default function PoolHistoryChart({ pollId, yesPool = 0, noPool = 0 }: PoolHistoryChartProps) {
  const [history, setHistory] = useState<HistoryData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('poll_history')
        .select('created_at, yes_pool, no_pool')
        .eq('poll_id', pollId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setHistory(data || [])
      setLoading(false)
    } catch (err) {
      console.error('fetch history error:', err)
      setLoading(false)
    }
  }, [pollId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchHistory()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [fetchHistory])

  if (loading) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-slate-800 rounded-xl">
        <p className="text-slate-500 text-sm">loading chart...</p>
      </div>
    )
  }

  const chartHistory = history.length > 0
    ? history
    : [
        { created_at: 'start', yes_pool: 0, no_pool: 0 },
        { created_at: 'current', yes_pool: yesPool, no_pool: noPool },
      ]

  // calculate scale for chart
  const maxPool = Math.max(
    1,
    ...chartHistory.map(h => Math.max(h.yes_pool, h.no_pool))
  )
  const chartWidth = 320
  const chartHeight = 180
  const padding = { top: 20, right: 20, bottom: 20, left: 20 }
  const graphWidth = chartWidth - padding.left - padding.right
  const graphHeight = chartHeight - padding.top - padding.bottom

  // generate SVG path for line
  const generatePath = (key: 'yes_pool' | 'no_pool') => {
    const points = chartHistory.map((h, i) => {
      const x = padding.left + (chartHistory.length === 1 ? graphWidth / 2 : (i / (chartHistory.length - 1)) * graphWidth)
      const y = padding.top + graphHeight - (h[key] / maxPool) * graphHeight
      return `${x},${y}`
    })

    // create smooth curve using quadratic bezier
    let path = `M ${points[0]}`
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1].split(',').map(Number)
      const [x2, y2] = points[i].split(',').map(Number)
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2
      path += ` Q ${cx},${cy} ${x2},${y2}`
    }
    return path
  }

  return (
    <div className="w-full bg-slate-800 rounded-xl p-4">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-48"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* grid lines */}
        <line
          x1={padding.left}
          y1={padding.top + graphHeight / 2}
          x2={chartWidth - padding.right}
          y2={padding.top + graphHeight / 2}
          stroke="rgba(100, 116, 139, 0.3)"
          strokeWidth="1"
        />

        {/* YES line (cyan) */}
        <path
          d={generatePath('yes_pool')}
          fill="none"
          stroke="rgb(34, 211, 238)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* NO line (pink) */}
        <path
          d={generatePath('no_pool')}
          fill="none"
          stroke="rgb(236, 72, 153)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* legend */}
      <div className="flex gap-4 mt-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
          <span className="text-cyan-400 text-xs">YES</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-500"></div>
          <span className="text-pink-500 text-xs">NO</span>
        </div>
      </div>
    </div>
  )
}

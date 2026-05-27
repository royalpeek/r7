'use client'

import { useEffect, useRef, useState } from 'react'

interface TimerProps {
  endsAt: string
  onExpire?: () => void
}

export default function Timer({ endsAt, onExpire }: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState('00:00:00')
  const [isExpired, setIsExpired] = useState(false)
  const hasExpiredRef = useRef(false)

  useEffect(() => {
    hasExpiredRef.current = false

    const calculateTimeRemaining = () => {
      const endTime = new Date(endsAt).getTime()
      const now = new Date().getTime()
      const difference = endTime - now

      if (difference <= 0) {
        setTimeRemaining('00:00:00')
        setIsExpired(true)
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true
          onExpire?.()
        }
        return
      }

      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((difference / (1000 * 60)) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      setTimeRemaining(formatted)
    }

    calculateTimeRemaining()

    const interval = setInterval(calculateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [endsAt, onExpire])

  return (
    <div className={`${isExpired ? 'bg-red-900 text-red-400' : 'bg-cyan-900 text-cyan-400'} px-3 py-1 rounded text-sm font-mono`}>
      {isExpired ? 'ENDED' : timeRemaining}
    </div>
  )
}

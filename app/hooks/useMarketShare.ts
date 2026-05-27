'use client'

import { useState } from 'react'
import { useHapticFeedback } from './useHapticFeedback'

type ShareMarketInput = {
  pollId: string
  question: string
}

type WebShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>
  clipboard?: Navigator['clipboard']
}

export function useMarketShare() {
  const haptics = useHapticFeedback()
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)

  const shareMarket = async ({ pollId, question }: ShareMarketInput) => {
    haptics.impact('light')

    if (typeof window === 'undefined') return

    const appUrl = window.location.origin
    const marketPayload = `market_${pollId}`
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '')
    const miniAppShortName = process.env.NEXT_PUBLIC_TELEGRAM_APP_SHORT_NAME
    const deepLink = botUsername && miniAppShortName
      ? `https://t.me/${botUsername}/${miniAppShortName}?startapp=${encodeURIComponent(marketPayload)}`
      : `${appUrl}/?market=${encodeURIComponent(pollId)}`
    const text = `R7 market: ${question}\nVote YES or NO on R7.`
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`
    const telegramApp = window.Telegram?.WebApp

    try {
      if (telegramApp?.openTelegramLink) {
        telegramApp.openTelegramLink(telegramShareUrl)
        setShareFeedback('Share sheet opened')
        return
      }

      const nav = navigator as WebShareNavigator
      if (nav.share) {
        await nav.share({
          title: 'R7 market',
          text,
          url: deepLink,
        })
        setShareFeedback('Share sheet opened')
        return
      }

      if (nav.clipboard?.writeText) {
        await nav.clipboard.writeText(`${text}\n${deepLink}`)
        setShareFeedback('Market link copied')
        return
      }

      window.open(telegramShareUrl, '_blank', 'noopener,noreferrer')
      setShareFeedback('Share page opened')
    } catch (error) {
      console.error('share market error:', error)
      setShareFeedback('Could not share this market')
      haptics.notification('warning')
    }
  }

  return {
    shareFeedback,
    clearShareFeedback: () => setShareFeedback(null),
    shareMarket,
  }
}

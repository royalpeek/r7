'use client'

import { useEffect, useState } from 'react'
import { buildMarketStartParam } from '@/lib/marketDeepLink'
import { useHapticFeedback } from './useHapticFeedback'
import { useTelegramUser } from './useTelegramUser'

type ShareMarketInput = {
  pollId: string
  question: string
}

type WebShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>
  clipboard?: Navigator['clipboard']
}

let cachedReferralCode: string | null = null
let referralCodeRequested = false
const referralCodeListeners = new Set<(code: string) => void>()

export function useMarketShare() {
  const haptics = useHapticFeedback()
  const { initData, userId } = useTelegramUser()
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(cachedReferralCode)

  useEffect(() => {
    const listener = (code: string) => setReferralCode(code)
    referralCodeListeners.add(listener)
    return () => {
      referralCodeListeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    if (!userId || referralCode || referralCodeRequested) return

    referralCodeRequested = true
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/me/referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        })
        const data = await response.json()

        if (response.ok && data.referralCode) {
          cachedReferralCode = data.referralCode
          setReferralCode(data.referralCode)
          referralCodeListeners.forEach(listener => listener(data.referralCode))
        }
      } catch (error) {
        console.error('share referral code error:', error)
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [initData, referralCode, userId])

  const shareMarket = async ({ pollId, question }: ShareMarketInput) => {
    haptics.impact('light')

    if (typeof window === 'undefined') return

    const appUrl = window.location.origin
    const marketPayload = buildMarketStartParam(pollId, referralCode)
    const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'r7_opinionsbot').replace(/^@/, '')
    const miniAppShortName = process.env.NEXT_PUBLIC_TELEGRAM_APP_SHORT_NAME || 'r7app'
    const deepLink = botUsername && miniAppShortName
      ? `https://t.me/${botUsername}/${miniAppShortName}?startapp=${encodeURIComponent(marketPayload)}`
      : `${appUrl}/?market=${encodeURIComponent(pollId)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ''}`
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

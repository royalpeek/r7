'use client'

import { useRef } from 'react'
import Script from 'next/script'

type TelegramAnalyticsWindow = Window & {
  telegramAnalytics?: {
    init: (options: { token: string; appName: string }) => void
  }
}

type TelegramAnalyticsProps = {
  token?: string
  appName?: string
}

export default function TelegramAnalytics({ token, appName = 'r7app' }: TelegramAnalyticsProps) {
  const initialized = useRef(false)

  if (!token) return null

  const initializeAnalytics = () => {
    if (initialized.current) return

    const analyticsWindow = window as TelegramAnalyticsWindow
    if (!analyticsWindow.telegramAnalytics) return

    analyticsWindow.telegramAnalytics.init({
      token,
      appName,
    })
    initialized.current = true
  }

  return (
    <Script
      src="https://tganalytics.xyz/index.js"
      strategy="afterInteractive"
      onLoad={initializeAnalytics}
    />
  )
}

'use client'

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotificationType = 'error' | 'success' | 'warning'

type TelegramHapticFeedback = {
  impactOccurred?: (style: ImpactStyle) => void
  notificationOccurred?: (type: NotificationType) => void
  selectionChanged?: () => void
}

type TelegramWebAppWithHaptics = {
  HapticFeedback?: TelegramHapticFeedback
}

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  navigator.vibrate(pattern)
}

export function useHapticFeedback() {
  const getHaptics = () => {
    if (typeof window === 'undefined') return undefined
    return (window.Telegram?.WebApp as TelegramWebAppWithHaptics | undefined)?.HapticFeedback
  }

  return {
    selection() {
      const haptics = getHaptics()
      if (haptics?.selectionChanged) {
        haptics.selectionChanged()
        return
      }
      vibrate(8)
    },
    impact(style: ImpactStyle = 'light') {
      const haptics = getHaptics()
      if (haptics?.impactOccurred) {
        haptics.impactOccurred(style)
        return
      }
      vibrate(style === 'heavy' ? 35 : style === 'medium' ? 22 : 12)
    },
    notification(type: NotificationType) {
      const haptics = getHaptics()
      if (haptics?.notificationOccurred) {
        haptics.notificationOccurred(type)
        return
      }
      vibrate(type === 'error' ? [20, 40, 20] : type === 'warning' ? [15, 30, 15] : 25)
    },
  }
}

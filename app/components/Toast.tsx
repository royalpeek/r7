'use client'

import { X } from 'lucide-react'

type ToastType = 'error' | 'success' | 'info'

export default function Toast({
  message,
  type = 'error',
  onClose,
}: {
  message: string | null
  type?: ToastType
  onClose: () => void
}) {
  if (!message) return null

  const styles = type === 'success'
    ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
    : type === 'info'
      ? 'border-slate-600 bg-slate-900 text-slate-100'
      : 'border-pink-500/40 bg-pink-500/10 text-pink-100'

  return (
    <div className="fixed left-4 right-4 top-4 z-[90] mx-auto max-w-sm">
      <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${styles}`}>
        <p className="min-w-0 flex-1 text-sm font-semibold">{message}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-full p-0.5 opacity-70 active:scale-95 transition"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

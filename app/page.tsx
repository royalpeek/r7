'use client'

import { useState } from 'react'
import { X, Wallet, RefreshCw, PlusCircle, Send, QrCode } from 'lucide-react'
import PollCard from './components/PollCard'
import { usePolls } from './hooks/usePolls'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'

export default function Home() {
  const [showWallet, setShowWallet] = useState(false)
  const { userId, loading: userLoading } = useTelegramUser()
  const { polls, loading: pollsLoading } = usePolls(userId)

  const handleCopy = () => {
    navigator.clipboard.writeText('3wbjCZ...kDdM')
  }

  const loading = userLoading || pollsLoading

  return (
    <div className="bg-slate-950 h-screen overflow-hidden flex flex-col">
      {/* debug display - remove later */}
      <div className="fixed top-0 left-0 bg-red-900 text-red-400 text-xs p-3 z-50 max-w-xs break-words">
        <div>userId: {userId || 'loading...'}</div>
        <div>userLoading: {userLoading.toString()}</div>
        <div>pollsLoading: {pollsLoading.toString()}</div>
      </div>

      {/* header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">r7</h1>
        <button
          onClick={() => setShowWallet(true)}
          className="bg-slate-800 text-slate-400 px-4 py-2 rounded text-sm"
        >
          $64.167 USDT
        </button>
      </div>

      {/* poll card fills remaining space */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">loading polls...</p>
          </div>
        ) : polls.length > 0 ? (
          <PollCard polls={polls} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">no polls yet</p>
          </div>
        )}
      </div>

      {/* wallet sheet overlay */}
      {showWallet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowWallet(false)}
          />
          <div className="relative bg-slate-950 rounded-t-3xl p-6 pb-12 z-10">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-6" />
            <button
              onClick={() => setShowWallet(false)}
              className="absolute top-6 right-6 text-slate-400"
            >
              <X size={20} />
            </button>
            <p className="text-white text-2xl font-bold mb-1">Wallet</p>
            <p className="text-slate-400 text-sm mb-6">yourname@gmail.com</p>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet size={18} className="text-cyan-400" />
                <p className="text-white font-mono text-sm">3wbjCZ...kDdM</p>
              </div>
              <button onClick={handleCopy}>
                <QrCode size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6">
              <p className="text-slate-400 text-xs mb-2">USDT Balance</p>
              <div className="flex items-center justify-between">
                <p className="text-white text-3xl font-bold">$64.167</p>
                <button className="bg-slate-800 p-2 rounded-full">
                  <RefreshCw size={16} className="text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mb-6">
              <button className="flex-1 bg-cyan-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
                <PlusCircle size={18} />
                Add Funds
              </button>
              <button className="flex-1 bg-slate-900 border border-slate-700 text-cyan-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
                <Send size={18} />
                Send USDT
              </button>
            </div>
            <button className="w-full flex items-center justify-center gap-2 text-slate-400 text-sm py-2">
              <span>🎟️</span>
              Have a referral code?
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
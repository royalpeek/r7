'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Users, BarChart3, Vote, WalletCards, Radar, Send } from 'lucide-react'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { getMarketLifecycleLabel, getMarketLifecycleStatus } from '@/lib/marketLifecycle'

type Role = 'user' | 'creator' | 'admin'

type AdminUser = {
  id: string
  username: string | null
  balance: number | null
  role: Role
  is_creator?: boolean
  created_at?: string
}

type AdminPoll = {
  id: string
  question: string
  status: 'active' | 'paused' | 'closed' | 'archived' | string | null
  yes_pool: number
  no_pool: number
  yes_votes: number
  no_votes: number
  ends_at: string
}

type AdminOverview = {
  stats: {
    totalUsers: number
    totalPolls: number
    totalVotes: number
    totalVolume: number
  }
  users: AdminUser[]
  polls: AdminPoll[]
}

type TonScanResult = {
  ok: boolean
  network: string
  checked: number
  credited: number
  skipped: number
}

const roles: Role[] = ['user', 'creator', 'admin']

export default function AdminPage() {
  const haptics = useHapticFeedback()
  const { appUser, initData, loading: userLoading } = useTelegramUser()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [updatingPollId, setUpdatingPollId] = useState<string | null>(null)
  const [tonScanLoading, setTonScanLoading] = useState(false)
  const [tonScanResult, setTonScanResult] = useState<TonScanResult | null>(null)
  const [recoveryUserId, setRecoveryUserId] = useState('')
  const [recoveryAddress, setRecoveryAddress] = useState('')
  const [recoveryAmount, setRecoveryAmount] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryResult, setRecoveryResult] = useState<string | null>(null)

  const isAdmin = appUser?.role === 'admin'

  const fetchOverview = useCallback(async () => {
    if (!initData) return

    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to load admin')
      setOverview(data as AdminOverview)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'failed to load admin')
    } finally {
      setLoading(false)
    }
  }, [initData])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!userLoading && isAdmin) {
        fetchOverview()
        return
      }

      if (!userLoading) setLoading(false)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [fetchOverview, isAdmin, userLoading])

  const updateRole = async (userId: string, role: Role) => {
    try {
      haptics.selection()
      setUpdatingUserId(userId)
      setError(null)

      const response = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, userId, role }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to update role')

      setOverview(prev => prev ? {
        ...prev,
        users: prev.users.map(user => user.id === userId ? data.user : user),
      } : prev)
      haptics.notification('success')
    } catch (error) {
      haptics.notification('error')
      setError(error instanceof Error ? error.message : 'failed to update role')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const updatePoll = async (pollId: string, action: 'pause' | 'resume' | 'close' | 'archive' | 'delete') => {
    if (action === 'delete') {
      const confirmed = window.confirm('Delete this market permanently? This also removes its votes and chart history.')
      if (!confirmed) return
    }

    try {
      haptics.selection()
      setUpdatingPollId(pollId)
      setError(null)

      const response = await fetch('/api/admin/polls/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, pollId, action }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to update market')

      setOverview(prev => {
        if (!prev) return prev

        if (action === 'delete') {
          const deletedPoll = prev.polls.find(poll => poll.id === pollId)
          const deletedVolume = deletedPoll
            ? Number(deletedPoll.yes_pool || 0) + Number(deletedPoll.no_pool || 0)
            : 0
          const deletedVotes = deletedPoll
            ? Number(deletedPoll.yes_votes || 0) + Number(deletedPoll.no_votes || 0)
            : 0

          return {
            ...prev,
            stats: {
              ...prev.stats,
              totalPolls: Math.max(0, prev.stats.totalPolls - 1),
              totalVotes: Math.max(0, prev.stats.totalVotes - deletedVotes),
              totalVolume: Math.max(0, prev.stats.totalVolume - deletedVolume),
            },
            polls: prev.polls.filter(poll => poll.id !== pollId),
          }
        }

        return {
          ...prev,
          polls: prev.polls.map(poll => poll.id === pollId ? data.poll : poll),
        }
      })
      haptics.notification('success')
    } catch (error) {
      haptics.notification('error')
      setError(error instanceof Error ? error.message : 'failed to update market')
    } finally {
      setUpdatingPollId(null)
    }
  }

  const scanTonDepositsNow = async () => {
    try {
      haptics.selection()
      setTonScanLoading(true)
      setTonScanResult(null)
      setError(null)

      const response = await fetch('/api/admin/ton-deposits/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to scan TON deposits')

      setTonScanResult(data as TonScanResult)
      haptics.notification('success')
      await fetchOverview()
    } catch (error) {
      haptics.notification('error')
      setError(error instanceof Error ? error.message : 'failed to scan TON deposits')
    } finally {
      setTonScanLoading(false)
    }
  }

  const recoverTonWallet = async () => {
    const confirmed = window.confirm('Send funds from this user custodial wallet? This never reveals their mnemonic.')
    if (!confirmed) return

    try {
      haptics.selection()
      setRecoveryLoading(true)
      setRecoveryResult(null)
      setError(null)

      const response = await fetch('/api/admin/ton-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          userId: recoveryUserId,
          address: recoveryAddress,
          amount: recoveryAmount,
        }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'recovery failed')

      setRecoveryResult(data.pending ? 'Recovery submitted' : 'Recovery sent')
      setRecoveryUserId('')
      setRecoveryAddress('')
      setRecoveryAmount('')
      haptics.notification('success')
      await fetchOverview()
    } catch (error) {
      haptics.notification('error')
      setError(error instanceof Error ? error.message : 'recovery failed')
    } finally {
      setRecoveryLoading(false)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 pb-28 pt-5">
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
          <p className="text-slate-400">loading admin...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 pb-28 pt-5">
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
          <ShieldCheck size={42} className="mb-4 text-slate-600" />
          <p className="text-xl font-bold text-white">Admin only</p>
          <p className="mt-2 max-w-xs text-sm text-slate-500">This area is only available to the app owner.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-28 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-400">Owner</p>
          <h1 className="text-2xl font-bold text-white">Admin</h1>
        </div>
        <button
          onClick={() => {
            haptics.selection()
            fetchOverview()
          }}
          className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-300 active:scale-95 transition"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
          {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <StatCard icon={<Users size={18} />} label="Users" value={overview?.stats.totalUsers ?? 0} />
        <StatCard icon={<BarChart3 size={18} />} label="Polls" value={overview?.stats.totalPolls ?? 0} />
        <StatCard icon={<Vote size={18} />} label="Votes" value={overview?.stats.totalVotes ?? 0} />
        <StatCard icon={<WalletCards size={18} />} label="Volume" value={`$${(overview?.stats.totalVolume ?? 0).toFixed(2)}`} />
      </div>

      <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">TON Deposits</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Run the testnet deposit scanner immediately and credit matching memo deposits.</p>
          </div>
          <button
            disabled={tonScanLoading}
            onClick={scanTonDepositsNow}
            className="flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tonScanLoading ? <RefreshCw size={16} className="animate-spin" /> : <Radar size={16} />}
            Scan
          </button>
        </div>
        {tonScanResult && (
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-950 p-3 text-center">
            <div>
              <p className="text-xs text-slate-500">Network</p>
              <p className="text-sm font-bold text-cyan-300">{tonScanResult.network}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Checked</p>
              <p className="text-sm font-bold text-white">{tonScanResult.checked}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Credited</p>
              <p className="text-sm font-bold text-emerald-300">{tonScanResult.credited}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Skipped</p>
              <p className="text-sm font-bold text-slate-300">{tonScanResult.skipped}</p>
            </div>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">TON Recovery</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Verify the user first. This signs in memory and never shows the mnemonic.</p>
        </div>
        <div className="space-y-3">
          <input
            value={recoveryUserId}
            onChange={event => setRecoveryUserId(event.target.value)}
            placeholder="User Telegram ID"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
          <input
            value={recoveryAddress}
            onChange={event => setRecoveryAddress(event.target.value)}
            placeholder="Destination TON address"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
          <input
            value={recoveryAmount}
            onChange={event => setRecoveryAmount(event.target.value)}
            placeholder="Amount"
            inputMode="decimal"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
          <button
            disabled={recoveryLoading || !recoveryUserId.trim() || !recoveryAddress.trim() || !recoveryAmount.trim()}
            onClick={recoverTonWallet}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {recoveryLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            Recover Funds
          </button>
          {recoveryResult && (
            <p className="rounded-xl bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">{recoveryResult}</p>
          )}
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Users</h2>
          <p className="text-xs text-slate-500">recent 50</p>
        </div>
        <div className="space-y-3">
          {(overview?.users || []).map(user => (
            <div key={user.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">@{user.username || 'unknown'}</p>
                  <p className="text-xs text-slate-500">{user.id}</p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-cyan-400">
                  {user.role}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(role => (
                  <button
                    key={role}
                    disabled={user.role === role || updatingUserId === user.id}
                    onClick={() => updateRole(user.id, role)}
                    className={`rounded-lg px-2 py-2 text-xs font-bold transition disabled:cursor-not-allowed ${
                      user.role === role
                        ? 'bg-cyan-400 text-black'
                        : 'bg-slate-800 text-slate-300 active:scale-95'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent Polls</h2>
          <p className="text-xs text-slate-500">recent 25</p>
        </div>
        <div className="space-y-3">
          {(overview?.polls || []).map(poll => {
            const totalPool = Number(poll.yes_pool || 0) + Number(poll.no_pool || 0)
            const status = getMarketLifecycleStatus(poll.status, poll.ends_at)
            const isBusy = updatingPollId === poll.id

            return (
              <div key={poll.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    status === 'archived'
                      ? 'bg-violet-500/15 text-violet-300'
                      : status === 'paused'
                      ? 'bg-amber-500/15 text-amber-300'
                      : status === 'closed' || status === 'ended'
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-cyan-400 text-black'
                  }`}>
                    {getMarketLifecycleLabel(status)}
                  </span>
                  <span className="text-xs text-slate-500">${totalPool.toFixed(2)} vol</span>
                </div>
                <p className="mb-3 font-semibold text-white">{poll.question}</p>
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-400">{poll.yes_votes} YES</span>
                  <span className="text-pink-500">{poll.no_votes} NO</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {status === 'paused' || status === 'archived' ? (
                    <button
                      disabled={isBusy}
                      onClick={() => updatePoll(poll.id, 'resume')}
                      className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      disabled={isBusy || status === 'closed' || status === 'ended'}
                      onClick={() => updatePoll(poll.id, 'pause')}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Pause
                    </button>
                  )}
                  <button
                    disabled={isBusy || status === 'closed' || status === 'archived' || status === 'ended'}
                    onClick={() => updatePoll(poll.id, 'close')}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Close
                  </button>
                  <button
                    disabled={isBusy || status === 'archived'}
                    onClick={() => updatePoll(poll.id, 'archive')}
                    className="col-span-2 rounded-lg bg-violet-500/15 px-3 py-2 text-xs font-bold text-violet-200 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Archive / Hide
                  </button>
                  <button
                    disabled={isBusy}
                    onClick={() => updatePoll(poll.id, 'delete')}
                    className="col-span-2 rounded-lg border border-pink-500/50 bg-pink-500/10 px-3 py-2 text-xs font-bold text-pink-200 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete Test Market
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-cyan-400">
        {icon}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

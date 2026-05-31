'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Users, BarChart3, Vote, WalletCards, Radar, Send, ShieldAlert } from 'lucide-react'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { getMarketLifecycleLabel, getMarketLifecycleStatus } from '@/lib/marketLifecycle'

type Role = 'user' | 'creator' | 'admin'
type AdminTab = 'overview' | 'wallet' | 'users' | 'markets'

type AdminUser = {
  id: string
  username: string | null
  balance: number | null
  role: Role
  is_creator?: boolean
  created_at?: string
  device_registered?: boolean
  device_last_seen_at?: string | null
  device_fingerprint?: string | null
  device_block_reason?: 'phone_taken' | 'mismatch' | null
  device_blocked_by_user_id?: string | null
  device_blocked_by_username?: string | null
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
  walletAuditLogs: WalletAuditLog[]
  deviceSecurityLogs: DeviceSecurityLog[]
}

type WalletAuditLog = {
  id: string
  event: string
  actor_user_id: string | null
  target_user_id: string | null
  wallet_address: string | null
  tx_hash: string | null
  status: 'success' | 'failed' | string
  details?: {
    amount?: number
    pending?: boolean
    traceId?: string
    reason?: string
  } | null
  created_at: string
}

type DeviceSecurityLog = {
  id: string
  event: string
  user_id: string | null
  device_fingerprint: string | null
  status: 'success' | 'blocked' | 'failed' | string
  details?: {
    ownerUserId?: string
    newUser?: boolean
  } | null
  created_at: string
}

type TonScanResult = {
  ok: boolean
  network: string
  checked: number
  credited: number
  skipped: number
}

const roles: Role[] = ['user', 'creator', 'admin']

const adminTabs: Array<{ value: AdminTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'users', label: 'Users' },
  { value: 'markets', label: 'Markets' },
]

function formatAuditEvent(event: string) {
  return event
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortValue(value?: string | null) {
  if (!value) return '--'
  if (value.length <= 14) return value
  return `${value.slice(0, 6)}...${value.slice(-6)}`
}

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
  const [unlockIdentifier, setUnlockIdentifier] = useState('')
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null)
  const [unlockResult, setUnlockResult] = useState<string | null>(null)
  const [recentlyClearedUserIds, setRecentlyClearedUserIds] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

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

  const unlockDevice = async (identifier: string) => {
    const trimmed = identifier.trim()
    if (!trimmed) return

    try {
      haptics.selection()
      setUnlockingUserId(trimmed)
      setUnlockResult(null)
      setError(null)

      const response = await fetch('/api/admin/unlock-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, userId: trimmed }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to unlock device')

      const clearedUserId = String(data.userId)
      const clearedOwnerUserId = data.clearedOwnerUserId
        ? String(data.clearedOwnerUserId)
        : null
      setUnlockResult(String(data.message || `Device access reset for ${clearedUserId}.`))
      setUnlockIdentifier('')
      setRecentlyClearedUserIds(prev => {
        const next = { ...prev, [clearedUserId]: Date.now() }
        if (clearedOwnerUserId) next[clearedOwnerUserId] = Date.now()
        return next
      })
      haptics.notification('success')
      setOverview(prev => prev ? {
        ...prev,
        users: prev.users.map(user => {
          if (user.id === clearedUserId) {
            return {
              ...user,
              device_registered: false,
              device_last_seen_at: null,
              device_fingerprint: null,
              device_block_reason: null,
              device_blocked_by_user_id: null,
              device_blocked_by_username: null,
            }
          }

          if (clearedOwnerUserId && user.id === clearedOwnerUserId) {
            return {
              ...user,
              device_registered: false,
              device_last_seen_at: null,
              device_fingerprint: null,
            }
          }

          return user
        }),
      } : prev)
      await fetchOverview()
    } catch (error) {
      haptics.notification('error')
      setError(error instanceof Error ? error.message : 'failed to unlock device')
    } finally {
      setUnlockingUserId(null)
    }
  }

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
      const confirmed = window.confirm('Delete this test market permanently? This removes the market, votes, and chart history. Use only for test cleanup.')
      if (!confirmed) return
    }

    if (action === 'close') {
      const confirmed = window.confirm('Close this market now? Users will stop staking and results will be shown.')
      if (!confirmed) return
    }

    if (action === 'archive') {
      const confirmed = window.confirm('Archive and hide this market from the app? You can resume it later if needed.')
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

      <div className="sticky top-0 z-10 -mx-4 mb-5 border-b border-slate-900 bg-slate-950/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="grid grid-cols-4 rounded-2xl bg-slate-900 p-1">
          {adminTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => {
                haptics.selection()
                setActiveTab(tab.value)
              }}
              className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
                activeTab === tab.value
                  ? 'bg-cyan-400 text-black'
                  : 'text-slate-400 active:scale-95'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-2.5">
            <StatCard icon={<Users size={18} />} label="Users" value={overview?.stats.totalUsers ?? 0} />
            <StatCard icon={<BarChart3 size={18} />} label="Markets" value={overview?.stats.totalPolls ?? 0} />
            <StatCard icon={<Vote size={18} />} label="Votes" value={overview?.stats.totalVotes ?? 0} />
            <StatCard icon={<WalletCards size={18} />} label="Volume" value={`$${(overview?.stats.totalVolume ?? 0).toFixed(2)}`} />
          </div>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-bold text-white">Today</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Use the Wallet tab for money movement and audit logs, Users for roles, and Markets for test market cleanup.
            </p>
            <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
              <p className="text-sm font-bold text-cyan-200">Account rule active</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                One Telegram ID and one registered device per account. Blocked attempts appear in Users.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <button
                onClick={() => {
                  haptics.selection()
                  setActiveTab('wallet')
                }}
                className="rounded-xl bg-slate-950 px-2 py-3 text-xs font-bold text-cyan-300 active:scale-95"
              >
                Wallet
              </button>
              <button
                onClick={() => {
                  haptics.selection()
                  setActiveTab('users')
                }}
                className="rounded-xl bg-slate-950 px-2 py-3 text-xs font-bold text-cyan-300 active:scale-95"
              >
                Users
              </button>
              <button
                onClick={() => {
                  haptics.selection()
                  setActiveTab('markets')
                }}
                className="rounded-xl bg-slate-950 px-2 py-3 text-xs font-bold text-cyan-300 active:scale-95"
              >
                Markets
              </button>
            </div>
          </section>
        </>
      )}

      {activeTab === 'wallet' && (
        <>
          <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">TON Deposits</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Run the testnet deposit scanner now and credit matching deposits.
                </p>
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
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Verify the user first. This signs in memory and never shows the mnemonic.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="recovery-user-id" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  User Telegram ID
                </label>
                <input
                  id="recovery-user-id"
                  value={recoveryUserId}
                  onChange={event => setRecoveryUserId(event.target.value)}
                  placeholder="Example: 123456789"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label htmlFor="recovery-address" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Destination TON address
                </label>
                <input
                  id="recovery-address"
                  value={recoveryAddress}
                  onChange={event => setRecoveryAddress(event.target.value)}
                  placeholder="Paste destination address"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label htmlFor="recovery-amount" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Amount
                </label>
                <input
                  id="recovery-amount"
                  value={recoveryAmount}
                  onChange={event => setRecoveryAmount(event.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>
              <button
                disabled={recoveryLoading || !recoveryUserId.trim() || !recoveryAddress.trim() || !recoveryAmount.trim()}
                onClick={recoverTonWallet}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recoveryLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                Recover Funds
              </button>
              {recoveryResult && (
                <p className="rounded-xl bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                  {recoveryResult}
                </p>
              )}
            </div>
          </section>

          <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Wallet Audit</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Recent security events. No wallet secrets are shown here.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-cyan-300">
                <ShieldAlert size={18} />
              </div>
            </div>

            {(overview?.walletAuditLogs || []).length === 0 ? (
              <div className="rounded-xl bg-slate-950 px-4 py-4 text-sm text-slate-500">
                No wallet audit events yet.
              </div>
            ) : (
              <div className="space-y-3">
                {(overview?.walletAuditLogs || []).map(log => {
                  const amount = typeof log.details?.amount === 'number'
                    ? `${log.details.amount.toFixed(3)} TON`
                    : null
                  const isFailed = log.status === 'failed' || log.event.endsWith('_failed')

                  return (
                    <div key={log.id} className="rounded-xl bg-slate-950 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{formatAuditEvent(log.event)}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          isFailed ? 'bg-pink-500/15 text-pink-300' : 'bg-emerald-400/10 text-emerald-300'
                        }`}>
                          {isFailed ? 'Failed' : log.details?.pending ? 'Pending' : 'Done'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-900 px-3 py-2">
                          <p className="text-slate-500">User</p>
                          <p className="mt-1 font-semibold text-slate-200">{log.target_user_id || '--'}</p>
                        </div>
                        <div className="rounded-lg bg-slate-900 px-3 py-2">
                          <p className="text-slate-500">Actor</p>
                          <p className="mt-1 font-semibold text-slate-200">{log.actor_user_id || '--'}</p>
                        </div>
                        <div className="rounded-lg bg-slate-900 px-3 py-2">
                          <p className="text-slate-500">Amount</p>
                          <p className="mt-1 font-semibold text-slate-200">{amount || '--'}</p>
                        </div>
                        <div className="rounded-lg bg-slate-900 px-3 py-2">
                          <p className="text-slate-500">Tx</p>
                          <p className="mt-1 font-semibold text-slate-200">{shortValue(log.tx_hash)}</p>
                        </div>
                      </div>

                      {log.details?.reason && (
                        <p className="mt-3 rounded-lg bg-pink-500/10 px-3 py-2 text-xs font-semibold text-pink-200">
                          {log.details.reason}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'users' && (
        <>
          <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-bold text-white">Reset device registration</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Use when someone is stuck on “account locked.” If their phone is already tied to another R7 account,
              this also releases that other registration so they can log in. R7 still allows only one Telegram account per phone.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                value={unlockIdentifier}
                onChange={event => setUnlockIdentifier(event.target.value)}
                placeholder="User ID or @username"
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
              />
              <button
                type="button"
                disabled={!unlockIdentifier.trim() || unlockingUserId !== null}
                onClick={() => unlockDevice(unlockIdentifier)}
                className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Unlock
              </button>
            </div>
            {unlockResult && (
              <p className="mt-3 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                {unlockResult}
              </p>
            )}
          </section>

          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Users</h2>
              <p className="text-xs text-slate-500">recent 25</p>
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
                  <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-3 text-xs">
                    <div>
                      <p className="text-slate-500">Balance</p>
                      <p className="mt-1 font-bold text-white">${Number(user.balance || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Joined</p>
                      <p className="mt-1 font-bold text-white">{user.created_at ? formatDateTime(user.created_at) : '--'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-500">Device</p>
                      <p className={`mt-1 font-bold ${
                        recentlyClearedUserIds[user.id]
                          ? 'text-emerald-300'
                          : user.device_block_reason === 'phone_taken'
                            ? 'text-pink-300'
                            : user.device_registered
                              ? 'text-amber-200'
                              : 'text-slate-400'
                      }`}>
                        {recentlyClearedUserIds[user.id]
                          ? 'Cleared just now — ask them to reopen R7'
                          : user.device_block_reason === 'phone_taken'
                            ? `Locked — phone used by @${user.device_blocked_by_username || user.device_blocked_by_user_id || 'another account'}`
                            : user.device_block_reason === 'mismatch'
                              ? 'Locked — different device on file'
                              : user.device_registered
                                ? `Linked${user.device_last_seen_at ? ` · ${formatDateTime(user.device_last_seen_at)}` : ''}`
                                : 'Not linked'}
                      </p>
                    </div>
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
                  {user.role === 'admin' ? (
                    <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-center text-xs text-slate-500">
                      Admin accounts are not hard-locked by device rules.
                    </p>
                  ) : user.device_registered || user.device_block_reason ? (
                    <button
                      type="button"
                      disabled={unlockingUserId === user.id}
                      onClick={() => unlockDevice(user.id)}
                      className="mt-3 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {unlockingUserId === user.id
                        ? 'Resetting...'
                        : user.device_block_reason === 'phone_taken'
                          ? 'Release phone for this user'
                          : 'Reset device access'}
                    </button>
                  ) : (
                    <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-center text-xs text-slate-500">
                      {recentlyClearedUserIds[user.id]
                        ? 'Reset done. Ask them to fully close and reopen the mini app.'
                        : 'No device lock on file for this user.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Device Security</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Login checks and blocked multi-account attempts. Fingerprints are shown shortened.
              </p>
            </div>
            {(overview?.deviceSecurityLogs || []).length === 0 ? (
              <div className="rounded-xl bg-slate-950 px-4 py-4 text-sm text-slate-500">
                No device security events yet.
              </div>
            ) : (
              <div className="space-y-3">
                {(overview?.deviceSecurityLogs || []).map(log => (
                  <div key={log.id} className="rounded-xl bg-slate-950 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{formatAuditEvent(log.event)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        log.status === 'blocked'
                          ? 'bg-pink-500/15 text-pink-300'
                          : 'bg-emerald-400/10 text-emerald-300'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-900 px-3 py-2">
                        <p className="text-slate-500">User</p>
                        <p className="mt-1 font-semibold text-slate-200">{log.user_id || '--'}</p>
                      </div>
                      <div className="rounded-lg bg-slate-900 px-3 py-2">
                        <p className="text-slate-500">Device</p>
                        <p className="mt-1 font-semibold text-slate-200">{shortValue(log.device_fingerprint)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'markets' && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Recent Markets</h2>
            <p className="text-xs text-slate-500">recent 50</p>
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
      )}
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

'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Users, BarChart3, Vote, WalletCards } from 'lucide-react'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'

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
  status: string | null
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

const roles: Role[] = ['user', 'creator', 'admin']

export default function AdminPage() {
  const haptics = useHapticFeedback()
  const { appUser, initData, loading: userLoading } = useTelegramUser()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

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
    <div className="min-h-screen bg-slate-950 px-4 pb-32 pt-5">
      <div className="mb-5 flex items-center justify-between">
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

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatCard icon={<Users size={18} />} label="Users" value={overview?.stats.totalUsers ?? 0} />
        <StatCard icon={<BarChart3 size={18} />} label="Polls" value={overview?.stats.totalPolls ?? 0} />
        <StatCard icon={<Vote size={18} />} label="Votes" value={overview?.stats.totalVotes ?? 0} />
        <StatCard icon={<WalletCards size={18} />} label="Volume" value={`$${(overview?.stats.totalVolume ?? 0).toFixed(2)}`} />
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Users</h2>
          <p className="text-xs text-slate-500">recent 25</p>
        </div>
        <div className="space-y-3">
          {(overview?.users || []).map(user => (
            <div key={user.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
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
            const ended = new Date(poll.ends_at) <= new Date()

            return (
              <div key={poll.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${ended ? 'bg-slate-800 text-slate-400' : 'bg-cyan-400 text-black'}`}>
                    {ended ? 'ended' : poll.status || 'active'}
                  </span>
                  <span className="text-xs text-slate-500">${totalPool.toFixed(2)} vol</span>
                </div>
                <p className="mb-3 font-semibold text-white">{poll.question}</p>
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-400">{poll.yes_votes} YES</span>
                  <span className="text-pink-500">{poll.no_votes} NO</span>
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
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-cyan-400">
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

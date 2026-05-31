'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { X, Wallet, RefreshCw, PlusCircle, Send, Filter, Lock, MapPin, Zap, ReceiptText, QrCode, Copy, Repeat2, Share2 } from 'lucide-react'
import PollCard from './components/PollCard'
import Toast from './components/Toast'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { usePolls } from './hooks/usePolls'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'
import { getMarketLifecycleStatus } from '@/lib/marketLifecycle'
import { parseMarketStartParam } from '@/lib/marketDeepLink'
import { TRADING_ASSET_NAME, formatTradingAsset, formatSignedTradingAsset } from '@/lib/tradingAsset'

const DISCOVERY_TABS = [
  { label: 'Trending', value: 'trending' },
  { label: 'New', value: 'new' },
  { label: 'Politics', value: 'politics' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Sports', value: 'sports' },
  { label: 'Tech', value: 'tech' },
  { label: 'Economy', value: 'economy' },
  { label: 'Science', value: 'science' },
  { label: 'Other', value: 'other' },
]

type WalletTransaction = {
  id: string
  type: string
  amount: number
  balance_after?: number | null
  description?: string | null
  status?: 'pending' | 'confirmed' | 'failed' | null
  tx_hash?: string | null
  created_at: string
}

type TonWalletInfo = {
  network: string
  asset: string
  address: string
  memo: string
  memoRequired?: boolean
  configured: boolean
}

function shortAddress(address?: string) {
  if (!address) return 'Wallet not ready'
  if (address.length <= 14) return address

  return `${address.slice(0, 6)}...${address.slice(-6)}`
}

function getTransactionLabel(transaction: WalletTransaction) {
  switch (transaction.type) {
    case 'ton_deposit':
      return 'Deposit'
    case 'ton_withdrawal':
      return 'Send'
    case 'stake':
      return transaction.description || 'Vote'
    case 'fee':
      return 'Voting fee'
    case 'claim_payout':
      return 'Claim'
    case 'creator_reward':
      return 'Creator reward'
    case 'test_credit':
      return 'Test credit'
    default:
      return transaction.description || 'Transaction'
  }
}

function getTransactionUnit(transaction: WalletTransaction) {
  return transaction.type.startsWith('ton_') ? 'TON' : TRADING_ASSET_NAME
}

function getTransactionStatus(transaction: WalletTransaction) {
  if (transaction.status) return transaction.status
  return 'confirmed'
}

export default function Home() {
  const haptics = useHapticFeedback()
  const [showWallet, setShowWallet] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('trending')
  const [filterStatus, setFilterStatus] = useState('active')
  const [sortBy, setSortBy] = useState('oldest')
  const [showDetail, setShowDetail] = useState(false)
  const [deepLinkedMarketId, setDeepLinkedMarketId] = useState<string | null>(null)
  const [deepLinkedReferralCode, setDeepLinkedReferralCode] = useState<string | null>(null)

  // create poll form state
  const [pollTitle, setPollTitle] = useState('')
  const [pollDescription, setPollDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isLocal, setIsLocal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createReasons, setCreateReasons] = useState<string[]>([])
  const [createSuggestion, setCreateSuggestion] = useState<string | null>(null)
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [quota, setQuota] = useState<{
    canCreate: boolean
    isAdmin: boolean
    limit: number | null
    used: number
    remaining: number | null
  } | null>(null)

  const { userId, appUser, initData, deviceFingerprint, authError, loading: userLoading, retryAuth } = useTelegramUser()
  const { polls, loading: pollsLoading, error: pollsError, refetch } = usePolls(userId, initData)
  const userRole = appUser?.role || (appUser?.is_creator ? 'creator' : 'user')
  const canCreatePoll = userRole === 'creator' || userRole === 'admin'
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null)
  const balance = balanceOverride ?? Number(appUser?.balance ?? 0)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [tonWallet, setTonWallet] = useState<TonWalletInfo | null>(null)
  const [tonWalletLoading, setTonWalletLoading] = useState(false)
  const [walletNotice, setWalletNotice] = useState<string | null>(null)
  const [walletSuccess, setWalletSuccess] = useState<string | null>(null)
  const [showWithdrawForm, setShowWithdrawForm] = useState(false)
  const [showWithdrawReview, setShowWithdrawReview] = useState(false)
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [showWalletDeposit, setShowWalletDeposit] = useState(false)
  const [showWalletHistory, setShowWalletHistory] = useState(false)
  const [depositQr, setDepositQr] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawComment, setWithdrawComment] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    if (!userId) return

    try {
      setTransactionsLoading(true)
      const response = await fetch('/api/me/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (response.ok) setTransactions((data.transactions || []) as WalletTransaction[])
    } catch (error) {
      console.error('fetch transactions error:', error)
    } finally {
      setTransactionsLoading(false)
    }
  }, [initData, userId])

  const fetchTonWallet = useCallback(async (options?: { forceLoader?: boolean }) => {
    if (!userId) return

    const shouldShowLoader = options?.forceLoader || !tonWallet

    try {
      if (shouldShowLoader) setTonWalletLoading(true)
      const response = await fetch('/api/me/ton-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, device: deviceFingerprint }),
      })
      const data = await response.json()

      if (response.ok) setTonWallet(data as TonWalletInfo)
    } catch (error) {
      console.error('fetch TON wallet error:', error)
    } finally {
      if (shouldShowLoader) setTonWalletLoading(false)
    }
  }, [deviceFingerprint, initData, tonWallet, userId])

  const fetchWalletBalance = useCallback(async () => {
    if (!userId) return

    try {
      const response = await fetch('/api/me/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (response.ok && typeof data.balance === 'number') {
        setBalanceOverride(data.balance)
      }
    } catch (error) {
      console.error('fetch wallet balance error:', error)
    }
  }, [initData, userId])

  const fetchCreatorQuota = useCallback(async () => {
    if (!canCreatePoll) return

    try {
      setQuotaLoading(true)
      const response = await fetch('/api/creator/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (response.ok) setQuota(data)
    } catch (error) {
      console.error('fetch creator quota error:', error)
    } finally {
      setQuotaLoading(false)
    }
  }, [canCreatePoll, initData])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchCreatorQuota()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [fetchCreatorQuota])

  useEffect(() => {
    if (!showWallet) return

    const timeout = window.setTimeout(() => {
      fetchTransactions()
      fetchTonWallet()
      fetchWalletBalance()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [fetchTonWallet, fetchTransactions, fetchWalletBalance, showWallet])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const telegramApp = window.Telegram?.WebApp
      const startParam = telegramApp?.startParam || telegramApp?.initDataUnsafe?.start_param
      const marketParam = new URLSearchParams(window.location.search).get('market')
      const referralParam = new URLSearchParams(window.location.search).get('ref')
      const parsedStartParam = parseMarketStartParam(startParam)
      const parsedMarketParam = parseMarketStartParam(marketParam)
      const marketId = parsedStartParam.marketId || parsedMarketParam.marketId
      const referralCode = parsedStartParam.referralCode || referralParam

      if (marketId) setDeepLinkedMarketId(marketId)
      if (referralCode) setDeepLinkedReferralCode(referralCode.toUpperCase())
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!deepLinkedReferralCode || !userId || userLoading) return

    const storageKey = `r7-referral-${deepLinkedReferralCode}`
    if (window.sessionStorage.getItem(storageKey)) return

    const timeout = window.setTimeout(async () => {
      try {
        window.sessionStorage.setItem(storageKey, '1')
        await fetch('/api/referrals/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, code: deepLinkedReferralCode }),
        })
      } catch (error) {
        console.error('auto referral apply error:', error)
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [deepLinkedReferralCode, initData, userId, userLoading])

  useEffect(() => {
    if ((!showDepositForm && !showWalletDeposit) || !tonWallet?.address) return

    let cancelled = false
    QRCode.toDataURL(tonWallet.address, {
      margin: 1,
      width: 220,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then(url => {
        if (!cancelled) setDepositQr(url)
      })
      .catch(error => {
        console.error('deposit QR error:', error)
      })

    return () => {
      cancelled = true
    }
  }, [showDepositForm, showWalletDeposit, tonWallet?.address])

  useEffect(() => {
    if (!walletSuccess) return

    const timeout = window.setTimeout(() => setWalletSuccess(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [walletSuccess])

  const copyWalletValue = async (value: string, label: string) => {
    if (!value) return

    await navigator.clipboard.writeText(value)
    haptics.selection()
    setWalletNotice(`${label} copied`)
    setWalletSuccess(`${label} copied`)
  }

  const shareWalletAddress = async () => {
    if (!tonWallet?.address) return

    haptics.selection()
    const shareText = `R7 ${TRADING_ASSET_NAME} address: ${tonWallet.address}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'R7 wallet address',
          text: shareText,
        })
        return
      } catch {
        return
      }
    }

    await copyWalletValue(tonWallet.address, 'Address')
  }

  const handleWithdraw = async () => {
    if (withdrawLoading) return

    try {
      haptics.selection()
      setWithdrawLoading(true)
      setWithdrawError(null)

      const response = await fetch('/api/me/ton-withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          address: withdrawAddress,
          amount: withdrawAmount,
          comment: withdrawComment,
          device: deviceFingerprint,
        }),
      })
      let data: { error?: string; balance?: number; traceId?: string; pending?: boolean } = {}
      try {
        data = await response.json()
      } catch {
        data = {}
      }

      if (!response.ok) {
        const traceText = data.traceId ? ` (${data.traceId})` : ''
        throw new Error(`${data.error || 'Send did not complete. Please wait a minute and try again.'}${traceText}`)
      }

      if (typeof data.balance === 'number') setBalanceOverride(data.balance)
      setWithdrawAddress('')
      setWithdrawAmount('')
      setWithdrawComment('')
      setShowWithdrawForm(false)
      setShowWithdrawReview(false)
      setWalletNotice(data.pending ? `${withdrawAmount} TON submitted` : `${withdrawAmount} TON sent`)
      setWalletSuccess(data.pending
        ? `${withdrawAmount} TON submitted. It may take a minute to appear.`
        : `${withdrawAmount} TON sent successfully`
      )
      haptics.notification('success')
      await Promise.all([fetchTransactions(), fetchWalletBalance()])
    } catch (error) {
      haptics.notification('error')
      setWithdrawError(error instanceof Error ? error.message : 'Send failed')
    } finally {
      setWithdrawLoading(false)
    }
  }

  const openWithdrawReview = () => {
    haptics.selection()
    setWithdrawError(null)
    setShowWithdrawReview(true)
  }

  const handleCreatePoll = async () => {
    if (!pollTitle.trim()) {
      setCreateError('please enter a title')
      return
    }
    if (!userId) {
      setCreateError('user not found')
      return
    }

    setCreating(true)
    setCreateError(null)
    setCreateReasons([])
    setCreateSuggestion(null)
    setSuggestedTitle(null)

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: pollTitle,
          initData,
          description: pollDescription,
          is_private: isPrivate,
          device: deviceFingerprint,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setCreateError(data.error || 'Market did not pass moderation.')
        setCreateReasons(Array.isArray(data.reasons) ? data.reasons : [])
        setCreateSuggestion(data.suggestion || null)
        setSuggestedTitle(data.suggestedTitle || null)
        return
      }

      // reset form and close modal
      setPollTitle('')
      setPollDescription('')
      setIsPrivate(false)
      setIsLocal(false)
      setShowCreatePoll(false)
      setCreateReasons([])
      setCreateSuggestion(null)
      setSuggestedTitle(null)
      await Promise.all([
        refetch(),
        fetchCreatorQuota(),
      ])
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'failed to create poll. try again.')
      setCreateReasons([])
      setCreateSuggestion(null)
      setSuggestedTitle(null)
    } finally {
      setCreating(false)
    }
  }

  const loading = (userLoading || pollsLoading) && polls.length === 0
  const showPollsError = Boolean(pollsError && polls.length === 0)
  const deepLinkedPoll = deepLinkedMarketId
    ? polls.find(poll => poll.id === deepLinkedMarketId)
    : null
  const effectiveFilterStatus = deepLinkedPoll
    ? getMarketLifecycleStatus(deepLinkedPoll.status, deepLinkedPoll.ends_at) === 'live'
      ? 'active'
      : 'ended'
    : filterStatus
  const activeDiscoveryTab = DISCOVERY_TABS.find(tab => tab.value === selectedCategory) || DISCOVERY_TABS[0]

  // filter and sort polls
  const filteredPolls = polls
    .filter(poll => {
      const lifecycleStatus = getMarketLifecycleStatus(poll.status, poll.ends_at)
      const matchesStatus = effectiveFilterStatus === 'active'
        ? lifecycleStatus === 'live'
        : lifecycleStatus === 'ended' || lifecycleStatus === 'closed'
      const matchesCategory = deepLinkedMarketId || selectedCategory === 'trending' || selectedCategory === 'new'
        ? true
        : (poll.category || 'other').toLowerCase() === selectedCategory

      return matchesStatus && matchesCategory
    })
    .sort((a, b) => {
      const totalA = a.yes_pool + a.no_pool
      const totalB = b.yes_pool + b.no_pool

      if (selectedCategory === 'trending') {
        return totalB - totalA || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }

      if (selectedCategory === 'new') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }

      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'highest-volume':
          return totalB - totalA
        case 'lowest-volume':
          return totalA - totalB
        default:
          return 0
      }
    })

  return (
    <div className="bg-slate-950 h-screen overflow-hidden flex flex-col">
      {authError && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 px-6 text-center">
          <div className="max-w-sm rounded-3xl border border-pink-500/30 bg-slate-900 p-6">
            <p className="text-xl font-bold text-white">Account locked</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              {authError}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              R7 allows one account per Telegram ID and one device.
            </p>
            <button
              type="button"
              onClick={retryAuth}
              className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black active:scale-95 transition"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* top controls */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowFilter(true)}
            className="h-10 w-10 flex-shrink-0 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300 active:scale-95 transition"
            title="Filter"
          >
            <Filter size={19} className="mx-auto" />
          </button>

          <Image src="/logo.png" alt="r7" width={58} height={29} className="h-7 w-auto flex-shrink-0" priority />
        </div>

        <div className="flex items-center gap-2">
        <button
          onClick={() => {
            haptics.impact('medium')
            setShowWallet(true)
          }}
          className="h-10 rounded-xl bg-slate-800 px-3 text-xs font-medium text-slate-300 whitespace-nowrap active:scale-95 transition"
        >
          {formatTradingAsset(balance)}
        </button>

        {canCreatePoll && (
          <button
            onClick={() => {
              haptics.impact('medium')
              fetchCreatorQuota()
              setShowCreatePoll(true)
            }}
            className="h-10 flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 text-sm font-bold text-black hover:bg-cyan-500 active:scale-95 transition"
          >
            <PlusCircle size={16} />
            Create
          </button>
        )}
        </div>
      </div>

      {/* category tabs - ONLY show on home page, NOT on detail page */}
      {!showDetail && (
        <div className="flex gap-5 px-3 pt-1 pb-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {DISCOVERY_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => {
                haptics.selection()
                setSelectedCategory(tab.value)
              }}
              className={`whitespace-nowrap pb-2 text-sm font-semibold transition border-b-2 ${
                selectedCategory === tab.value
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-400 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* poll card fills remaining space */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
            <div>
              <p className="text-white font-semibold">Loading markets</p>
              <p className="text-slate-500 text-sm mt-1">Getting the latest markets ready.</p>
            </div>
          </div>
        ) : showPollsError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="rounded-2xl border border-pink-500/40 bg-pink-500/10 px-5 py-4">
              <p className="text-white font-semibold">Could not load markets</p>
              <p className="text-slate-400 text-sm mt-1">Check your connection and try again.</p>
            </div>
            <button
              onClick={() => {
                haptics.selection()
                refetch(true)
              }}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black active:scale-95 transition"
            >
              Retry
            </button>
          </div>
        ) : filteredPolls.length > 0 ? (
          <PollCard
            polls={filteredPolls}
            focusPollId={deepLinkedMarketId}
            availableBalance={balance}
            onDetailChange={nextShowDetail => {
              setShowDetail(nextShowDetail)
              if (!nextShowDetail) setDeepLinkedMarketId(null)
            }}
            onPollsChange={refetch}
            onBalanceChange={setBalanceOverride}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-white font-semibold">
              {filterStatus === 'active'
                ? `No ${activeDiscoveryTab.label.toLowerCase()} markets`
                : `No ended ${activeDiscoveryTab.label.toLowerCase()} markets`}
            </p>
            <p className="text-slate-500 text-sm mt-2">
              {filterStatus === 'active'
                ? 'New markets will appear here when they are created.'
                : 'Finished markets will appear here after they close.'}
            </p>
          </div>
        )}
      </div>

      {/* error feedback */}
      <Toast message={createError} onClose={() => setCreateError(null)} />
      <Toast message={walletSuccess} type="success" onClose={() => setWalletSuccess(null)} />

      {/* create poll modal */}
      {showCreatePoll && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 overflow-y-auto">
          <div className="flex-1 px-6 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            {/* back button */}
            <button
              onClick={() => {
                setShowCreatePoll(false)
                setCreateError(null)
                setCreateReasons([])
                setCreateSuggestion(null)
                setSuggestedTitle(null)
                setPollTitle('')
                setPollDescription('')
                setIsPrivate(false)
                setIsLocal(false)
              }}
              className="text-slate-400 text-sm mb-6 flex items-center gap-1"
            >
              ← Back
            </button>

            <h2 className="text-white text-3xl font-bold mb-4">Create Poll</h2>

            {/* polls remaining badge */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <Zap size={16} className="text-pink-400" />
              <span className="text-pink-400 text-sm font-medium">
                {quotaLoading
                  ? 'checking poll limit...'
                  : quota?.isAdmin
                    ? 'admin: unlimited polls'
                    : `${quota?.remaining ?? 0}/${quota?.limit ?? 2} open market slots available`}
              </span>
            </div>

            {/* title input */}
            <div className="mb-5">
              <p className="text-white text-sm font-medium mb-2">
                Title <span className="text-slate-500">{pollTitle.length}/64</span>
              </p>
              <input
                type="text"
                maxLength={64}
                value={pollTitle}
                onChange={e => setPollTitle(e.target.value)}
                placeholder="Should robots replace workers at scale?"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* description input */}
            <div className="mb-5">
              <p className="text-white text-sm font-medium mb-2">
                Description <span className="text-slate-500">{pollDescription.length}/256</span>
              </p>
              <textarea
                maxLength={256}
                value={pollDescription}
                onChange={e => setPollDescription(e.target.value)}
                placeholder="Optional description for your market..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            {/* private poll toggle */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock size={18} className="text-slate-400" />
                <span className="text-white font-medium">Private Poll</span>
              </div>
              <button
                onClick={() => setIsPrivate(prev => !prev)}
                className={`w-12 h-6 rounded-full transition-colors ${isPrivate ? 'bg-cyan-400' : 'bg-slate-700'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* local poll toggle */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-slate-400" />
                <span className="text-white font-medium">Local Poll</span>
              </div>
              <button
                onClick={() => setIsLocal(prev => !prev)}
                className={`w-12 h-6 rounded-full transition-colors ${isLocal ? 'bg-cyan-400' : 'bg-slate-700'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${isLocal ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* creator earnings info */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💰</span>
                <span className="text-white font-bold">Creator Earnings</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Your cut</span>
                <span className="text-cyan-400 text-sm font-medium">0.25% win · 0.5% lose</span>
              </div>
              <p className="text-slate-500 text-xs">
                When your poll resolves, you earn 0.25% of the winning pool and 0.5% of the losing pool, paid directly in {TRADING_ASSET_NAME}.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-4 mb-6">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">Preview</p>
              <p className="text-white text-lg font-bold leading-tight">
                {pollTitle.trim() || 'Your market question will appear here'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-cyan-300">
                  Theme auto-detected
                </span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
                  24h market
                </span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
                  YES / NO only
                </span>
              </div>
            </div>

            {/* create button */}
            {createError && (
              <div className="mb-4 rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-3">
                <p className="text-sm font-semibold text-pink-100">{createError}</p>
                {createReasons.length > 1 && (
                  <div className="mt-3 space-y-1">
                    {createReasons.slice(1).map(reason => (
                      <p key={reason} className="text-xs font-medium text-pink-200">- {reason}</p>
                    ))}
                  </div>
                )}
                {createSuggestion && (
                  <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">Try this</p>
                    <p className="mt-1 text-sm font-semibold text-cyan-50">{createSuggestion}</p>
                    {suggestedTitle && (
                      <button
                        onClick={() => {
                          setPollTitle(suggestedTitle)
                          setCreateError(null)
                          setCreateReasons([])
                          setCreateSuggestion(null)
                          setSuggestedTitle(null)
                        }}
                        className="mt-3 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-black active:scale-95 transition"
                      >
                        Use suggestion
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleCreatePoll}
              disabled={creating || !pollTitle.trim() || (!quota?.isAdmin && quota?.remaining === 0)}
              className="w-full bg-cyan-400 text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-500 transition"
            >
              {creating ? 'Creating...' : 'Create Poll'}
            </button>
          </div>
        </div>
      )}

      {/* filter modal */}
      {showFilter && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowFilter(false)}
          />
          <div className="relative z-10 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-slate-950 px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-6" />
            <button
              onClick={() => setShowFilter(false)}
              className="absolute top-6 right-6 text-slate-400"
            >
              <X size={20} />
            </button>

            <p className="text-white text-2xl font-bold mb-6">Filter</p>

            {/* status filter */}
            <div className="mb-8">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">STATUS</p>
              <div className="space-y-3">
                <button
                  onClick={() => { setFilterStatus('active'); setShowFilter(false) }}
                  className={`w-full flex items-center justify-between py-3 px-4 rounded-lg border transition ${
                    filterStatus === 'active'
                      ? 'bg-cyan-900 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>Active</span>
                  {filterStatus === 'active' && <span>✓</span>}
                </button>
                <button
                  onClick={() => { setFilterStatus('expired'); setShowFilter(false) }}
                  className={`w-full flex items-center justify-between py-3 px-4 rounded-lg border transition ${
                    filterStatus === 'expired'
                      ? 'bg-cyan-900 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>Expired</span>
                  {filterStatus === 'expired' && <span>✓</span>}
                </button>
              </div>
            </div>

            {/* sort options */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">SORT BY</p>
              <div className="space-y-2">
                {[
                  { value: 'newest', label: 'Newest' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'highest-volume', label: 'Highest Volume' },
                  { value: 'lowest-volume', label: 'Lowest Volume' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => { setSortBy(option.value); setShowFilter(false) }}
                    className={`w-full text-left py-2 px-4 rounded transition ${
                      sortBy === option.value
                        ? 'bg-slate-800 text-cyan-400'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {sortBy === option.value && '✓ '}{option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* wallet sheet overlay */}
      {showWallet && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowWallet(false)}
          />
          <div className="relative z-10 max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-slate-950 px-5 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5" />
            <button
              onClick={() => setShowWallet(false)}
              className="absolute top-5 right-5 text-slate-400"
              aria-label="Close wallet"
            >
              <X size={20} />
            </button>
            <p className="text-white text-3xl font-bold mb-1">Wallet</p>
            <p className="text-slate-500 text-sm font-semibold mb-5">
              {appUser?.username ? `@${appUser.username}` : 'Custodial TON wallet'}
            </p>
            {walletNotice && (
              <div className="mb-5 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3">
                <p className="text-sm font-semibold text-cyan-100">{walletNotice}</p>
              </div>
            )}
            <button
              disabled={!tonWallet?.address}
              onClick={() => {
                if (!tonWallet?.address) return
                haptics.impact('medium')
                setShowWalletDeposit(true)
              }}
              className="mb-5 flex w-full items-center justify-between rounded-2xl bg-slate-900/90 px-4 py-4 text-left active:scale-[0.99] transition disabled:opacity-60"
              aria-label="Open wallet address and QR code"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Wallet size={22} className="shrink-0 text-emerald-300" />
                <p className="truncate text-lg font-bold text-white">{shortAddress(tonWallet?.address)}</p>
              </div>
              <QrCode size={22} className="shrink-0 text-slate-500" />
            </button>
            <div className="mb-5 rounded-2xl bg-slate-900/90 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-slate-500 text-sm font-bold">{TRADING_ASSET_NAME} Balance</p>
                  <p className="mt-2 text-white text-3xl font-bold">{formatTradingAsset(balance)}</p>
                </div>
                <button
                  onClick={() => {
                    haptics.selection()
                    fetchWalletBalance()
                    fetchTonWallet()
                  }}
                  className="rounded-2xl bg-slate-800 p-3 text-slate-400 active:scale-95 transition"
                  title="Refresh wallet"
                  aria-label="Refresh wallet balance"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
              {tonWalletLoading && (
                <p className="mt-3 text-xs font-semibold text-slate-500">Refreshing wallet...</p>
              )}
            </div>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                disabled={!tonWallet?.configured}
                onClick={() => {
                  haptics.selection()
                  setShowDepositForm(true)
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-4 text-base font-bold text-black active:scale-95 transition disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                aria-label="Add funds"
              >
                <PlusCircle size={20} />
                Add Funds
              </button>
              <button
                onClick={() => {
                  haptics.selection()
                  setShowWithdrawForm(true)
                  setShowWithdrawReview(false)
                  setWithdrawError(null)
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-slate-950 py-4 text-base font-bold text-emerald-300 active:scale-95 transition"
                aria-label="Send TON"
              >
                <Send size={20} />
                Send TON
              </button>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  haptics.selection()
                  setShowWalletHistory(true)
                  fetchTransactions()
                }}
                className="flex w-full items-center justify-between border-t border-slate-800 py-4 text-left active:scale-[0.99] transition"
                aria-label="Open transaction history"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-cyan-300">
                    <ReceiptText size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Transaction history</p>
                    <p className="text-xs text-slate-500">{transactions.length} records</p>
                  </div>
                </div>
                <span className="text-xl text-slate-500">›</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showWithdrawForm && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-900 px-5 py-5">
            <button
              onClick={() => {
                if (showWithdrawReview) {
                  setShowWithdrawReview(false)
                  return
                }
                setShowWithdrawForm(false)
                setWithdrawError(null)
              }}
              className="rounded-full bg-slate-900 p-3 text-slate-300 active:scale-95 transition"
              aria-label={showWithdrawReview ? 'Back to send form' : 'Close send form'}
            >
              <X size={20} />
            </button>
            <p className="text-lg font-bold text-white">{showWithdrawReview ? 'Review Send' : 'Send TON'}</p>
            <div className="h-11 w-11" />
          </div>
          {!showWithdrawReview ? (
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="mb-7 rounded-3xl bg-slate-900 px-5 py-7 text-center">
                <p className="text-sm font-bold text-slate-500">Available</p>
                <p className="mt-3 text-4xl font-bold text-white">{balance.toFixed(3)} TON</p>
              </div>
              <div className="space-y-5">
                <div>
                  <label htmlFor="withdraw-address" className="mb-2 block text-sm font-bold text-slate-400">Recipient Address</label>
                  <input
                    id="withdraw-address"
                    value={withdrawAddress}
                    onChange={event => setWithdrawAddress(event.target.value)}
                    placeholder="TON wallet address"
                    autoComplete="off"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-base text-white placeholder-slate-600 outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label htmlFor="withdraw-amount" className="mb-2 block text-sm font-bold text-slate-400">Amount</label>
                  <div className="flex gap-3">
                    <input
                      id="withdraw-amount"
                      value={withdrawAmount}
                      onChange={event => setWithdrawAmount(event.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-base text-white placeholder-slate-600 outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={() => setWithdrawAmount(Math.max(0, balance - 0.05).toFixed(3))}
                      className="rounded-2xl bg-emerald-400/15 px-5 text-sm font-bold text-emerald-300 active:scale-95 transition"
                      aria-label="Use maximum sendable balance"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="withdraw-comment" className="mb-2 block text-sm font-bold text-slate-400">Comment</label>
                  <input
                    id="withdraw-comment"
                    value={withdrawComment}
                    onChange={event => setWithdrawComment(event.target.value)}
                    placeholder="Optional"
                    maxLength={120}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-base text-white placeholder-slate-600 outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4">
                  <p className="text-sm font-semibold leading-relaxed text-amber-100">
                    Only send to TON testnet addresses. Wrong addresses cannot be recovered.
                  </p>
                </div>
                {withdrawError && (
                  <p className="rounded-2xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm font-semibold text-pink-100">
                    {withdrawError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="mb-5 rounded-3xl bg-slate-900 p-5">
                <p className="mb-4 text-sm font-bold text-slate-400">Check the details before sending.</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Amount</p>
                    <p className="mt-1 text-2xl font-bold text-white">{withdrawAmount || '0'} TON</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Destination</p>
                    <p className="mt-1 break-all text-sm font-semibold leading-relaxed text-white">{withdrawAddress}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-950 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Network</p>
                      <p className="mt-1 text-sm font-bold text-cyan-200">TON testnet</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Comment</p>
                      <p className="mt-1 truncate text-sm font-bold text-white">{withdrawComment.trim() || 'None'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4">
                <p className="text-sm font-semibold leading-relaxed text-amber-100">
                  Sends cannot be reversed. Make sure the address and network are correct.
                </p>
              </div>
              {withdrawError && (
                <p className="mt-5 rounded-2xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm font-semibold text-pink-100">
                  {withdrawError}
                </p>
              )}
            </div>
          )}
          <div className="border-t border-slate-900 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              disabled={withdrawLoading || !withdrawAddress.trim() || !withdrawAmount.trim()}
              onClick={showWithdrawReview ? handleWithdraw : openWithdrawReview}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-400 py-4 text-base font-bold text-black active:scale-95 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={18} />
              {showWithdrawReview
                ? withdrawLoading ? 'Sending...' : 'Confirm Send'
                : 'Review Send'}
            </button>
          </div>
        </div>
      )}

      {showWalletDeposit && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-900 px-5 py-4">
            <button
              onClick={() => setShowWalletDeposit(false)}
              className="rounded-full bg-slate-900 p-3 text-slate-300 active:scale-95 transition"
              aria-label="Close wallet address"
            >
              <X size={18} />
            </button>
            <p className="text-lg font-bold text-white">Wallet</p>
            <div className="h-10 w-10" />
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="mb-5 rounded-3xl bg-slate-900 p-4">
              <div className="mx-auto flex h-56 w-56 max-w-full items-center justify-center rounded-3xl bg-white p-4">
                {depositQr ? (
                  <Image src={depositQr} alt="Wallet QR code" width={224} height={224} className="h-full w-full" unoptimized />
                ) : (
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Your testnet TON address</p>
              <p className="break-all text-sm font-bold leading-relaxed text-white">{tonWallet?.address}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  disabled={!tonWallet?.address}
                  onClick={() => tonWallet && copyWalletValue(tonWallet.address, 'Address')}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-4 text-base font-bold text-black active:scale-95 transition disabled:opacity-50"
                  aria-label="Copy wallet address"
                >
                  <Copy size={18} />
                  Copy
                </button>
                <button
                  disabled={!tonWallet?.address}
                  onClick={shareWalletAddress}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 py-4 text-base font-bold text-emerald-300 active:scale-95 transition disabled:opacity-50"
                  aria-label="Share wallet address"
                >
                  <Share2 size={18} />
                  Share
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2 rounded-3xl bg-amber-400/10 px-5 py-4 text-sm font-semibold leading-relaxed text-amber-100">
              <p>Only send {TRADING_ASSET_NAME} to this address.</p>
              <p>No memo is needed.</p>
              <p>Wrong sends cannot be reversed.</p>
            </div>
          </div>
        </div>
      )}

      {showDepositForm && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-900 px-5 py-5">
            <button
              onClick={() => setShowDepositForm(false)}
              className="rounded-full bg-slate-900 p-3 text-slate-300 active:scale-95 transition"
              aria-label="Close add funds"
            >
              <X size={20} />
            </button>
            <p className="text-lg font-bold text-white">Add Funds</p>
            <div className="h-11 w-11" />
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className="mb-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-cyan-400 px-4 py-4 text-center text-black">
                <Repeat2 size={24} className="mx-auto mb-2" />
                <p className="text-sm font-bold">Exchange</p>
              </div>
              <button
                onClick={() => {
                  haptics.selection()
                  setShowDepositForm(false)
                  setShowWalletDeposit(true)
                }}
                className="rounded-2xl bg-slate-900 px-4 py-4 text-center text-slate-400 active:scale-95 transition"
                aria-label="Show wallet address"
              >
                <Wallet size={24} className="mx-auto mb-2" />
                <p className="text-sm font-bold">Wallet</p>
              </button>
            </div>

            <div className="mb-5 space-y-4 rounded-3xl bg-slate-900 p-5">
              {[
                'Open your exchange or testnet wallet.',
                'Choose Send or Withdraw.',
                `Send ${TRADING_ASSET_NAME} to your R7 address below.`,
              ].map((step, index) => (
                <div key={step} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-bold text-emerald-300">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm font-semibold leading-relaxed text-slate-200">{step}</p>
                </div>
              ))}
            </div>

            <div className="mb-5 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-3xl bg-slate-900 p-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white p-2">
                {depositQr ? (
                  <Image src={depositQr} alt="Deposit QR code" width={96} height={96} className="h-full w-full" unoptimized />
                ) : (
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                )}
              </div>
              <div className="min-w-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">R7 address</p>
                <p className="break-all text-sm font-bold leading-relaxed text-white">{tonWallet?.address}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 p-4">
              <button
                disabled={!tonWallet?.address}
                onClick={() => tonWallet && copyWalletValue(tonWallet.address, 'Deposit address')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-4 text-base font-bold text-black active:scale-95 transition disabled:opacity-50"
                aria-label="Copy deposit address"
              >
                <Copy size={18} />
                Copy address
              </button>
            </div>

            <div className="mt-5 space-y-2 rounded-3xl bg-amber-400/10 px-5 py-4 text-sm font-semibold leading-relaxed text-amber-100">
              <p>Only send {TRADING_ASSET_NAME} to this address.</p>
              <p>No memo is needed.</p>
              <p>Wrong sends cannot be reversed.</p>
            </div>
          </div>
        </div>
      )}

      {showWalletHistory && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950 px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">History</p>
              <p className="text-xs text-slate-500">Wallet transactions</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  haptics.selection()
                  fetchTransactions()
                  fetchWalletBalance()
                }}
                className="rounded-full bg-slate-900 p-3 text-slate-400 active:scale-95 transition"
                aria-label="Refresh transaction history"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => setShowWalletHistory(false)}
                className="rounded-full bg-slate-900 p-3 text-slate-400 active:scale-95 transition"
                aria-label="Close transaction history"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {transactionsLoading && transactions.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
                Loading history...
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
                No transactions yet.
              </div>
            ) : transactions.map(transaction => {
              const amount = Number(transaction.amount || 0)
              const positive = amount > 0
              const status = getTransactionStatus(transaction)
              const unit = getTransactionUnit(transaction)
              const amountText = unit === 'TON'
                ? `${positive ? '+' : '-'}${Math.abs(amount).toFixed(3)} TON`
                : formatSignedTradingAsset(amount)
              const balanceText = typeof transaction.balance_after === 'number'
                ? unit === 'TON'
                  ? `${Number(transaction.balance_after).toFixed(3)} TON`
                  : formatTradingAsset(Number(transaction.balance_after))
                : null

              return (
                <div key={transaction.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      status === 'pending'
                        ? 'bg-amber-400/10 text-amber-300'
                        : positive ? 'bg-cyan-400/10 text-cyan-400' : 'bg-pink-500/10 text-pink-400'
                    }`}>
                      <ReceiptText size={17} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{getTransactionLabel(transaction)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          status === 'pending'
                            ? 'bg-amber-400/10 text-amber-300'
                            : status === 'failed'
                              ? 'bg-pink-500/10 text-pink-300'
                              : 'bg-emerald-400/10 text-emerald-300'
                        }`}>
                          {status === 'pending' ? 'Pending' : status === 'failed' ? 'Failed' : 'Done'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(transaction.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${
                      status === 'pending' ? 'text-amber-300' : positive ? 'text-cyan-400' : 'text-pink-400'
                    }`}>
                      {amountText}
                    </p>
                    {balanceText && (
                      <p className="text-xs text-slate-500">{balanceText}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

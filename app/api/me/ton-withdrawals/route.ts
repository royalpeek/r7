import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { Address, SendMode, beginCell, external, internal, storeMessage, toNano } from '@ton/core'
import { mnemonicToPrivateKey } from '@ton/crypto'
import { WalletContractV4 } from '@ton/ton'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { recordTransaction } from '@/lib/transactions'
import { getTonAssetName, getTonNetwork, getToncenterJsonRpcEndpoint, getUserTonWalletSecret } from '@/lib/tonWallet'

export const runtime = 'nodejs'

const TESTNET_GAS_RESERVE = 0.05
const DEFAULT_TESTNET_WITHDRAW_LIMIT = 5
const CONFIRMATION_ATTEMPTS = 3
const CONFIRMATION_DELAY_MS = 1200
const NANOTON_PER_TON = 1_000_000_000

type ToncenterAddressInformation = {
  balance?: string
  status?: string
}

type ToncenterWalletInformation = ToncenterAddressInformation & {
  seqno?: number
  wallet_id?: number
  wallet_type?: string
}

function parseAmount(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid amount')

  return Number(amount.toFixed(9))
}

function parseDestination(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a wallet address')

  try {
    return Address.parse(value.trim())
  } catch {
    throw new Error('Enter a valid TON address')
  }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getToncenterApiV2Endpoint() {
  return getToncenterJsonRpcEndpoint().replace(/\/jsonRPC$/, '')
}

function getToncenterApiV3Endpoint() {
  return getToncenterApiV2Endpoint().replace(/\/api\/v2$/, '/api/v3')
}

function getTonApiBaseUrl() {
  return getTonNetwork() === 'testnet'
    ? 'https://testnet.tonapi.io'
    : 'https://tonapi.io'
}

async function runTonStep<T>(step: string, action: () => Promise<T>) {
  try {
    return await action()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`${step}: ${message}`)
  }
}

async function fetchToncenterV3<T>(
  apiBaseUrl: string,
  path: string,
  apiKey: string | undefined,
  params: Record<string, string>
) {
  const url = new URL(`${apiBaseUrl}/${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const headers: Record<string, string> = {}
  if (apiKey) headers['X-API-Key'] = apiKey

  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })
  const text = await response.text()
  let data: { error?: string; code?: number } & Partial<T> = {}

  try {
    data = JSON.parse(text)
  } catch {
    data = {}
  }

  if (!response.ok) {
    throw new Error(data.error || text || `TONCenter returned ${response.status}`)
  }

  return data as T
}

function tonFromNanotons(value: string | undefined) {
  const nanotons = Number(value || 0)
  if (!Number.isFinite(nanotons) || nanotons <= 0) return 0

  return Number((nanotons / NANOTON_PER_TON).toFixed(9))
}

async function sendMessageTonApi(apiBaseUrl: string, apiKey: string | undefined, boc: Buffer) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(`${apiBaseUrl}/v2/blockchain/message`, {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify({
      boc: boc.toString('hex'),
    }),
  })
  const text = await response.text()
  let data: { error?: string; error_code?: number } = {}

  try {
    data = JSON.parse(text)
  } catch {
    data = {}
  }

  if (!response.ok) {
    const message = data.error || text || `TonAPI returned ${response.status}`
    const lowerMessage = message.toLowerCase()
    const rejected = lowerMessage.includes('not accepted') || lowerMessage.includes('was not accepted')
    const looksSubmitted =
      !rejected &&
      (
        lowerMessage.includes('already') ||
        lowerMessage.includes('accepted') ||
        lowerMessage.includes('received') ||
        (lowerMessage.includes('transaction') && lowerMessage.includes('try again'))
      )

    if (looksSubmitted) {
      console.info('TonAPI reports message is already pending', { message })
      return
    }

    throw new Error(message)
  }
}

export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID().slice(0, 8)

  try {
    if (getTonNetwork() !== 'testnet') {
      return NextResponse.json({ error: 'Withdrawals are testnet only for now' }, { status: 403 })
    }

    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const amount = parseAmount(body.amount)
    const destination = parseDestination(body.address)
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 120) : ''
    const withdrawLimit = Number(process.env.TON_TESTNET_WITHDRAW_LIMIT || DEFAULT_TESTNET_WITHDRAW_LIMIT)

    if (amount > withdrawLimit) {
      return NextResponse.json({ error: `Max test withdrawal is ${withdrawLimit} TON` }, { status: 400 })
    }

    console.info('TON withdrawal started', {
      traceId,
      userId,
      amount,
      destination: destination.toString({ bounceable: false, testOnly: true }),
    })

    const supabase = getSupabaseAdmin()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const currentBalance = Number(user.balance ?? 0)
    if (!Number.isFinite(currentBalance)) throw new Error('Invalid balance')
    if (amount + TESTNET_GAS_RESERVE > currentBalance) {
      return NextResponse.json({ error: `Leave at least ${TESTNET_GAS_RESERVE} TON for fees` }, { status: 400 })
    }

    const storedWallet = await getUserTonWalletSecret(supabase, userId)
    const keyPair = await mnemonicToPrivateKey(storedWallet.mnemonic)
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    })
    const walletAddress = wallet.address.toString({
      bounceable: false,
      testOnly: true,
    })
    const addressInfo = await runTonStep(
      'Read wallet state',
      () => fetchToncenterV3<ToncenterAddressInformation>(
        getToncenterApiV3Endpoint(),
        'addressInformation',
        process.env.TONCENTER_API_KEY,
        {
          address: walletAddress,
          use_v2: 'false',
        }
      )
    )
    const chainBalance = tonFromNanotons(addressInfo.balance)

    console.info('TON withdrawal wallet checked', {
      traceId,
      wallet: walletAddress,
      appBalance: currentBalance,
      chainBalance,
      status: addressInfo.status,
    })

    if (amount + TESTNET_GAS_RESERVE > chainBalance) {
      return NextResponse.json({ error: 'Wallet needs more testnet TON for this send' }, { status: 400 })
    }

    const isDeployed = addressInfo.status === 'active'
    let seqno = 0
    let walletType: string | null = null
    if (isDeployed) {
      const walletInfo = await runTonStep(
        'Read wallet seqno',
        () => fetchToncenterV3<ToncenterWalletInformation>(
          getToncenterApiV3Endpoint(),
          'walletInformation',
          process.env.TONCENTER_API_KEY,
          {
            address: walletAddress,
            use_v2: 'false',
          }
        )
      )
      seqno = Number(walletInfo.seqno ?? 0)
      walletType = walletInfo.wallet_type || null

      if (!Number.isFinite(seqno)) {
        throw new Error('Read wallet seqno: TONCenter returned an invalid seqno')
      }
    }
    const transfer = await wallet.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: destination,
          value: toNano(amount.toString()),
          bounce: false,
          body: comment || undefined,
        }),
      ],
    })
    const message = external({
      to: wallet.address,
      init: isDeployed ? undefined : wallet.init,
      body: transfer,
    })
    const boc = beginCell().store(storeMessage(message)).endCell().toBoc()
    const messageHash = message.body.hash().toString('hex')
    const txHash = await runTonStep(
      'Submit send to TON',
      async () => {
        await sendMessageTonApi(
          getTonApiBaseUrl(),
          process.env.TONAPI_KEY,
          boc
        )

        return messageHash
      }
    )

    console.info('TON withdrawal submitted through TonAPI', { traceId, seqno, txHash, walletType })

    let confirmedSeqno = seqno
    for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt += 1) {
      await wait(CONFIRMATION_DELAY_MS)
      try {
        const latestWalletInfo = await fetchToncenterV3<ToncenterWalletInformation>(
          getToncenterApiV3Endpoint(),
          'walletInformation',
          process.env.TONCENTER_API_KEY,
          {
            address: walletAddress,
            use_v2: 'false',
          }
        )
        confirmedSeqno = Number(latestWalletInfo.seqno ?? 0)
      } catch (error) {
        console.error('TON confirmation check error:', { traceId, error })
      }
      if (confirmedSeqno > seqno) break
    }

    const isPending = confirmedSeqno <= seqno

    const nextBalance = Number((currentBalance - amount).toFixed(9))
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: nextBalance })
      .eq('id', userId)

    if (balanceError) throw balanceError

    await recordTransaction(supabase, {
      userId,
      type: 'ton_withdrawal',
      amount: -amount,
      balanceAfter: nextBalance,
      description: `${getTonAssetName()} withdrawal`,
    })

    return NextResponse.json({
      ok: true,
      balance: nextBalance,
      amount,
      seqno,
      txHash,
      traceId,
      pending: isPending,
    })
  } catch (error) {
    console.error('TON withdrawal error:', { traceId, error })
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send testnet TON',
      traceId,
    }, { status: 400 })
  }
}

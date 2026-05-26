import crypto from 'node:crypto'

export type VerifiedTelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60

const safeCompareHex = (a: string, b: string) => {
  const first = Buffer.from(a, 'hex')
  const second = Buffer.from(b, 'hex')

  if (first.length !== second.length) return false
  return crypto.timingSafeEqual(first, second)
}

export function verifyTelegramInitData(initData: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('missing TELEGRAM_BOT_TOKEN')

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) throw new Error('missing telegram hash')

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (!safeCompareHex(calculatedHash, hash)) {
    throw new Error('invalid telegram hash')
  }

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new Error('expired telegram auth')
  }

  const rawUser = params.get('user')
  if (!rawUser) throw new Error('missing telegram user')

  const user = JSON.parse(rawUser) as VerifiedTelegramUser
  if (!user.id) throw new Error('missing telegram user id')

  return user
}

export function getRequestTelegramUser(initData?: string) {
  if (initData) return verifyTelegramInitData(initData)

  if (process.env.NODE_ENV !== 'production') {
    return {
      id: 123,
      first_name: 'Test',
      username: 'test-user',
    } satisfies VerifiedTelegramUser
  }

  throw new Error('missing telegram init data')
}

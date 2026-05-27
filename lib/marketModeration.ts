export const MARKET_CATEGORIES = [
  { value: 'other', label: 'Other' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'tech', label: 'Tech' },
  { value: 'sports', label: 'Sports' },
  { value: 'politics', label: 'Politics' },
  { value: 'economy', label: 'Economy' },
  { value: 'science', label: 'Science' },
] as const

export const MARKET_DURATIONS = [
  { value: 6, label: '6h' },
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
] as const

export type MarketModerationResult = {
  approved: boolean
  normalizedQuestion: string
  category: string
  durationHours: number
  reasons: string[]
  similarMarket?: {
    id: string
    question: string
    score: number
  }
}

type ExistingMarket = {
  id: string
  question: string
}

const allowedOpeners = [
  'is',
  'are',
  'will',
  'would',
  'should',
  'can',
  'could',
  'does',
  'do',
  'did',
  'has',
  'have',
  'was',
  'were',
]

const stopWords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'by',
  'for',
  'from',
  'how',
  'if',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'should',
  'than',
  'that',
  'the',
  'to',
  'too',
  'will',
  'with',
  'would',
])

const blockedPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(kill|murder|assassinate|bomb|terrorist|terrorism|shoot|stab)\b/i, reason: 'No violence, threats, or violent-event markets.' },
  { pattern: /\b(suicide|self[-\s]?harm|cut myself|overdose)\b/i, reason: 'No self-harm markets.' },
  { pattern: /\b(rape|porn|sex tape|nude|nudes|explicit sex)\b/i, reason: 'No sexual or explicit markets.' },
  { pattern: /\b(minor|child|children|underage)\b.*\b(sex|dating|nude|porn)\b/i, reason: 'No sexual content involving minors.' },
  { pattern: /\b(buy|sell|long|short)\b.*\b(coin|token|stock|forex|crypto|btc|eth|sol)\b/i, reason: 'No direct trading or financial advice markets.' },
  { pattern: /\b(price|token|coin|stock)\b.*\b(hit|reach|pump|dump|moon)\b/i, reason: 'No direct price prediction markets for now.' },
  { pattern: /\b(diagnose|cure|treat|medicine|medication|disease|cancer|pregnant)\b/i, reason: 'No medical advice or diagnosis markets.' },
  { pattern: /\b(hack|steal|scam someone|phishing|carding|fraud)\b/i, reason: 'No illegal activity markets.' },
  { pattern: /\b(my|me|i)\b.*\b(win|lose|date|marry|rich|poor|die|pregnant)\b/i, reason: 'No personal-life markets about yourself or private people.' },
]

function normalizeQuestion(question: string) {
  return question
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
}

function tokenize(question: string) {
  return normalizeQuestion(question)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !stopWords.has(token))
}

function similarityScore(a: string, b: string) {
  const aTokens = new Set(tokenize(a))
  const bTokens = new Set(tokenize(b))
  if (aTokens.size === 0 || bTokens.size === 0) return 0

  let overlap = 0
  aTokens.forEach(token => {
    if (bTokens.has(token)) overlap += 1
  })

  const union = new Set([...aTokens, ...bTokens]).size
  return overlap / union
}

function normalizeCategory(category: unknown) {
  const value = String(category || 'other').toLowerCase()
  return MARKET_CATEGORIES.some(item => item.value === value) ? value : 'other'
}

function normalizeDurationHours(durationHours: unknown) {
  const value = Number(durationHours || 24)
  return MARKET_DURATIONS.some(item => item.value === value) ? value : 24
}

export function moderateMarketQuestion({
  question,
  category,
  durationHours,
  existingMarkets = [],
}: {
  question: string
  category?: unknown
  durationHours?: unknown
  existingMarkets?: ExistingMarket[]
}): MarketModerationResult {
  const normalizedQuestion = normalizeQuestion(question)
  const normalizedCategory = normalizeCategory(category)
  const normalizedDurationHours = normalizeDurationHours(durationHours)
  const reasons: string[] = []

  if (normalizedQuestion.length < 16) {
    reasons.push('Make the question more specific.')
  }

  if (normalizedQuestion.length > 96) {
    reasons.push('Keep the market title under 96 characters.')
  }

  if (!normalizedQuestion.endsWith('?')) {
    reasons.push('Market title must be written as a question.')
  }

  const firstWord = normalizedQuestion.split(/\s+/)[0]?.replace(/[^a-z]/gi, '').toLowerCase()
  if (!allowedOpeners.includes(firstWord)) {
    reasons.push('Start with a clear YES/NO opener like Is, Should, Would, Will, or Can.')
  }

  if (/\b(yes or no|true or false)\b/i.test(normalizedQuestion)) {
    reasons.push('Do not include "yes or no" in the title. The app already provides YES/NO choices.')
  }

  if (/[!?]{2,}/.test(normalizedQuestion) || /[A-Z]{8,}/.test(normalizedQuestion)) {
    reasons.push('Avoid spammy punctuation or all-caps wording.')
  }

  blockedPatterns.forEach(({ pattern, reason }) => {
    if (pattern.test(normalizedQuestion) && !reasons.includes(reason)) {
      reasons.push(reason)
    }
  })

  const similarMarket = existingMarkets
    .map(market => ({
      id: market.id,
      question: market.question,
      score: similarityScore(normalizedQuestion, market.question),
    }))
    .sort((a, b) => b.score - a.score)[0]

  if (similarMarket && similarMarket.score >= 0.72) {
    reasons.push('A very similar market already exists.')
  }

  return {
    approved: reasons.length === 0,
    normalizedQuestion,
    category: normalizedCategory,
    durationHours: normalizedDurationHours,
    reasons,
    similarMarket: similarMarket && similarMarket.score >= 0.72 ? similarMarket : undefined,
  }
}

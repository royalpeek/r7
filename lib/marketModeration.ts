export const MARKET_CATEGORIES = [
  { value: 'other', label: 'Other' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'tech', label: 'Tech' },
  { value: 'sports', label: 'Sports' },
  { value: 'politics', label: 'Politics' },
  { value: 'economy', label: 'Economy' },
  { value: 'science', label: 'Science' },
] as const

export const MARKET_DURATION_HOURS = 24

export type MarketModerationResult = {
  approved: boolean
  normalizedQuestion: string
  category: string
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
  { pattern: /\b\w+\b\s+(?:or|\/)\s+\b\w+\b/i, reason: 'This is not a clean YES/NO question. Rephrase A-or-B choices using "over" or "more than".' },
  { pattern: /\b(reduce|lower|increase|improve|affect|impact)\b.*\b(cost|costs|prices|effectiveness|effective)\b/i, reason: 'This question needs more nuance than a simple YES or NO.' },
  { pattern: /\b(will|would|could|can|does|do)\b.*\b(make|become|lead to|result in)\b.*\b(fairer|fairness|fair)\b/i, reason: 'No prediction-style markets about whether a system will become fairer.' },
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

function detectCategory(question: string, description?: string) {
  const text = `${question} ${description || ''}`.toLowerCase()

  if (/\b(crypto|bitcoin|btc|ethereum|eth|solana|sol|token|coin|web3|defi|dao|nft|blockchain)\b/.test(text)) {
    return 'crypto'
  }
  if (/\b(ai|robot|robots|tech|software|app|internet|algorithm|automation|machine|computer)\b/.test(text)) {
    return 'tech'
  }
  if (/\b(sport|sports|football|soccer|basketball|nba|nfl|world cup|team|league|match)\b/.test(text)) {
    return 'sports'
  }
  if (/\b(politics|government|election|president|senate|congress|policy|democracy|law)\b/.test(text)) {
    return 'politics'
  }
  if (/\b(economy|economic|money|inflation|market|markets|jobs|workers|salary|wage|business|invest|schools teach students how to invest)\b/.test(text)) {
    return 'economy'
  }
  if (/\b(science|mosquito|mosquitoes|climate|space|biology|physics|research|medicine)\b/.test(text)) {
    return 'science'
  }

  return 'other'
}

export function moderateMarketQuestion({
  question,
  description,
  existingMarkets = [],
}: {
  question: string
  description?: string
  existingMarkets?: ExistingMarket[]
}): MarketModerationResult {
  const normalizedQuestion = normalizeQuestion(question)
  const normalizedCategory = detectCategory(normalizedQuestion, description)
  const reasons: string[] = []

  if (normalizedQuestion.length < 16) {
    reasons.push('Make the question more specific.')
  }

  if (normalizedQuestion.length > 64) {
    reasons.push('Keep the market title under 64 characters.')
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
    reasons,
    similarMarket: similarMarket && similarMarket.score >= 0.72 ? similarMarket : undefined,
  }
}

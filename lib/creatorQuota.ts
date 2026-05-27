export const CREATOR_DAILY_POLL_LIMIT = 2

export function getLagosDayWindow(now = new Date()) {
  const lagosFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [year, month, day] = lagosFormatter.format(now).split('-').map(Number)
  const startUtc = new Date(Date.UTC(year, month - 1, day, -1, 0, 0, 0))
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)

  return {
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
  }
}

import { env } from '../config/env'

const TZ = env.DIGEST_TIMEZONE

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const wallClockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Wall-clock part values of `date` inside the configured timezone. */
function wallClock(date: Date) {
  const parts = wallClockFmt.formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Offset (in ms) between the configured timezone and UTC at a given instant. */
function tzOffsetMs(date: Date): number {
  const w = wallClock(date)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** `YYYY-MM-DD` for an instant, expressed in the configured timezone. */
export function toDateKey(date: Date = new Date()): string {
  return dateFmt.format(date)
}

/** Midnight (00:00:00) of `YYYY-MM-DD` in the configured timezone, as a Date. */
export function startOfDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0)
  return new Date(guess - tzOffsetMs(new Date(guess)))
}

/** 23:59:59.999 of `YYYY-MM-DD` in the configured timezone, as a Date. */
export function endOfDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59, 999)
  return new Date(guess - tzOffsetMs(new Date(guess)))
}

/** Shift a `YYYY-MM-DD` key by `delta` days. */
export function shiftDay(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + delta))
  return shifted.toISOString().slice(0, 10)
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  return (
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
  )
}

/** ISO timestamp of `now` annotated with the configured timezone offset. */
export function nowIso(): string {
  const date = new Date()
  const offsetMinutes = tzOffsetMs(date) / 60000
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${date.toISOString().slice(0, 19)}${sign}${hh}:${mm}`
}

export const timezone = TZ

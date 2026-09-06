const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Parse `YYYY-MM-DD` as a local calendar date (never a UTC instant). */
export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** `THURSDAY, AUGUST 28, 2026` */
export function longDate(dateKey: string): string {
  const date = parseDateKey(dateKey)
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/** `AUG 28` */
export function shortDate(dateKey: string): string {
  const date = parseDateKey(dateKey)
  return `${MONTHS[date.getMonth()].slice(0, 3).toUpperCase()} ${String(date.getDate()).padStart(2, '0')}`
}

/** `AUGUST 2026` */
export function monthLabel(dateKey: string): string {
  const date = parseDateKey(dateKey)
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

export function weekdayLabel(dateKey: string): string {
  return WEEKDAYS[parseDateKey(dateKey).getDay()].toUpperCase()
}

/** `00:00` local wall clock for a UTC timestamp string. */
export function timeOfDay(iso: string): string {
  if (!iso) return '--:--'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Whole days between two `YYYY-MM-DD` keys. */
export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from).getTime()
  const b = parseDateKey(to).getTime()
  return Math.round((b - a) / 86400000)
}

/** `5 min`, `3 h 20 m` — used by the next-issue countdown. */
export function formatCountdown(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'publishing'
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

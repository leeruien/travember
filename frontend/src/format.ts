const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** The API sends plain `YYYY-MM-DD` dates; parse them as local days so they don't shift across time zones. */
function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(iso: string) {
  return dateFormat.format(parseDay(iso))
}

export function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return dateFormat.formatRange(parseDay(start), parseDay(end))
  if (start) return `From ${formatDate(start)}`
  if (end) return `Until ${formatDate(end)}`
  return 'Undated'
}

/** For instants like a comment's `createdAt`, shown in the reader's time zone. */
export function formatTimestamp(iso: string) {
  return timestampFormat.format(new Date(iso))
}

/** The `YYYY-MM-DD` day a fraction `f` of the way from day `a` to day `b`. */
export function dayBetween(a: string, b: string, f: number) {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return new Date(ms(a) + (ms(b) - ms(a)) * f).toISOString().slice(0, 10)
}

export function formatCoords(lat: number, lng: number) {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? 'E' : 'W'}`
}

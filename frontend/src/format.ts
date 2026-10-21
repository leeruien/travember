const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

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

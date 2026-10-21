import { useState } from 'react'

interface NominatimResult {
  place_id: number
  name: string
  display_name: string
  lat: string
  lon: string
}

export interface SearchPick {
  name: string
  lat: number
  lng: number
}

/**
 * Looks places up with OpenStreetMap's free Nominatim service. Its usage policy forbids
 * search-as-you-type, so we only query when the user presses Enter or the button.
 */
export function PlaceSearch({ onPick }: { onPick: (pick: SearchPick) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    const q = query.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q, format: 'jsonv2', limit: '5', 'accept-language': navigator.language })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      if (!res.ok) throw new Error(String(res.status))
      setResults(await res.json())
    } catch {
      setError("Search isn't available right now. You can still click the map to drop a pin.")
    } finally {
      setBusy(false)
    }
  }

  function pick(r: NominatimResult) {
    onPick({ name: r.name || r.display_name.split(',')[0], lat: Number(r.lat), lng: Number(r.lon) })
    setResults(null)
    setQuery('')
  }

  return (
    <div className="search">
      {/* Not a <form>: this sits inside the place editor's form. */}
      <div className="search-row">
        <input
          type="search"
          placeholder="Search for a place…"
          aria-label="Search for a place"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              search()
            }
          }}
        />
        <button type="button" className="button button--ghost" onClick={search} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
      {results && (
        <ul className="search-results">
          {results.length === 0 && <li className="muted small">No matches.</li>}
          {results.map((r) => (
            <li key={r.place_id}>
              <button type="button" onClick={() => pick(r)}>
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

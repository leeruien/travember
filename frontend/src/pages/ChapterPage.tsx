import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Destination, type Place, type PlaceInput } from '../api'
import { useAuth } from '../auth'
import { formatDate, formatDateRange } from '../format'
import { ErrorNote, Loading } from '../components/Status'
import { PlaceSearch, type SearchPick } from '../components/PlaceSearch'
import { TripMap, type LatLng, type Pin } from '../components/TripMap'

/** A place being added (placeId null) or edited. */
interface Draft {
  placeId: string | null
  name: string
  note: string
  visitedOn: string
  pin: LatLng | null
}

const newDraft: Draft = { placeId: null, name: '', note: '', visitedOn: '', pin: null }

export function ChapterPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  // The whole book is loaded so we know this chapter's number and its neighbours.
  const [chapters, setChapters] = useState<Destination[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<LatLng | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    api.listDestinations().then(setChapters, (e: Error) => setLoadError(e.message))
  }, [])

  useEffect(() => {
    setSelectedId(null)
    setFocus(null)
    setDraft(null)
    setActionError(null)
  }, [id])

  if (loadError) return <ErrorNote message={loadError} />
  if (!chapters) return <Loading />

  const index = chapters.findIndex((d) => d.id === id)
  if (index < 0) {
    return (
      <ErrorNote title="Chapter not found" message="It may have been removed from the book.">
        <Link to="/">← Back to contents</Link>
      </ErrorNote>
    )
  }

  const chapter = chapters[index]
  const prev = chapters[index - 1]
  const next = chapters[index + 1]
  const isOwner = session?.user.id === chapter.ownerId

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setActionError(null)
    try {
      await action()
      return true
    } catch (e) {
      setActionError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function reload() {
    setChapters(await api.listDestinations())
  }

  async function savePlace() {
    if (!draft?.pin) return
    const input: PlaceInput = {
      name: draft.name,
      note: draft.note,
      latitude: draft.pin.lat,
      longitude: draft.pin.lng,
      visitedOn: draft.visitedOn || null,
    }
    const ok = await run(async () => {
      const saved = draft.placeId ? await api.updatePlace(draft.placeId, input) : await api.addPlace(chapter.id, input)
      await reload()
      setSelectedId(saved.id)
    })
    if (ok) setDraft(null)
  }

  function editPlace(p: Place) {
    const pin = { lat: p.latitude, lng: p.longitude }
    setDraft({ placeId: p.id, name: p.name, note: p.note ?? '', visitedOn: p.visitedOn ?? '', pin })
    setSelectedId(null)
    setFocus(pin)
  }

  async function removePlace(p: Place) {
    if (!confirm(`Remove “${p.name}” from this chapter?`)) return
    await run(async () => {
      await api.deletePlace(p.id)
      await reload()
    })
  }

  async function deleteChapter() {
    if (!confirm(`Delete “${chapter.title}” and all of its places? This can't be undone.`)) return
    if (await run(() => api.deleteDestination(chapter.id))) navigate('/')
  }

  function selectPlace(p: Place) {
    setSelectedId(p.id)
    setFocus({ lat: p.latitude, lng: p.longitude })
  }

  function pickSearchResult(pick: SearchPick) {
    if (!draft) return
    const pin = { lat: pick.lat, lng: pick.lng }
    setDraft({ ...draft, name: draft.name || pick.name, pin })
    setFocus(pin)
  }

  const pins: Pin[] = chapter.places
    .map((p, i) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      label: String(i + 1),
      title: p.name,
      subtitle: p.visitedOn ? formatDate(p.visitedOn) : undefined,
    }))
    .filter((p) => p.id !== draft?.placeId) // the place being edited is shown as the draft pin instead

  return (
    <article className="chapter">
      <header className="chapter-head">
        {chapter.coverImageUrl && <img className="chapter-cover" src={chapter.coverImageUrl} alt="" />}
        <p className="eyebrow">
          Chapter {index + 1}
          {chapter.country && ` · ${chapter.country}`}
        </p>
        <h1>{chapter.title}</h1>
        <p className="muted">{formatDateRange(chapter.startDate, chapter.endDate)}</p>
        {isOwner && (
          <div className="actions">
            <Link className="button button--ghost" to={`/chapters/${chapter.id}/edit`}>Edit chapter</Link>
            <button className="button button--danger" onClick={deleteChapter} disabled={busy}>Delete</button>
          </div>
        )}
      </header>

      {chapter.summary && <p className="summary">{chapter.summary}</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}

      <section className="chapter-body">
        <div className="chapter-map">
          <TripMap
            pins={pins}
            route
            selectedId={selectedId}
            draft={draft?.pin}
            focus={focus}
            onSelect={setSelectedId}
            onMapClick={draft ? (pin) => setDraft({ ...draft, pin }) : undefined}
          />
          {draft && (
            <p className="hint">Click the map to {draft.pin ? 'move' : 'drop'} the pin.</p>
          )}
        </div>

        <div className="chapter-places">
          <div className="section-head">
            <h2>Places</h2>
            {isOwner && !draft && (
              <button className="button" onClick={() => setDraft(newDraft)}>Add a place</button>
            )}
          </div>

          {draft && (
            <PlaceEditor
              draft={draft}
              busy={busy}
              onChange={setDraft}
              onSearchPick={pickSearchResult}
              onSave={savePlace}
              onCancel={() => setDraft(null)}
            />
          )}

          {chapter.places.length === 0 && !draft && (
            <p className="muted">
              No places pinned yet.{isOwner && ' Add the first one — search for it or click the map.'}
            </p>
          )}

          <ol className="places">
            {chapter.places.map((p, i) => (
              <li key={p.id} className={p.id === selectedId ? 'is-selected' : undefined}>
                <button className="place-link" onClick={() => selectPlace(p)}>
                  <span className="place-num">{i + 1}</span>
                  <span>
                    <strong>{p.name}</strong>
                    {p.visitedOn && <span className="muted small"> · {formatDate(p.visitedOn)}</span>}
                  </span>
                </button>
                {p.note && <p className="place-note">{p.note}</p>}
                {isOwner && !draft && (
                  <div className="place-actions">
                    <button className="link" onClick={() => editPlace(p)}>Edit</button>
                    <button className="link link--danger" onClick={() => removePlace(p)} disabled={busy}>Remove</button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <nav className="pager">
        {prev ? <Link to={`/chapters/${prev.id}`}>← {prev.title}</Link> : <Link to="/">← Contents</Link>}
        {next && <Link to={`/chapters/${next.id}`}>{next.title} →</Link>}
      </nav>
    </article>
  )
}

function PlaceEditor({ draft, busy, onChange, onSearchPick, onSave, onCancel }: {
  draft: Draft
  busy: boolean
  onChange: (draft: Draft) => void
  onSearchPick: (pick: SearchPick) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <form
      className="card place-editor"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <h3>{draft.placeId ? 'Edit place' : 'New place'}</h3>
      <PlaceSearch onPick={onSearchPick} />
      <label>
        Name
        <input required maxLength={200} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      </label>
      <label>
        Visited on
        <input type="date" value={draft.visitedOn} onChange={(e) => onChange({ ...draft, visitedOn: e.target.value })} />
      </label>
      <label>
        Note
        <textarea rows={3} maxLength={5000} value={draft.note} onChange={(e) => onChange({ ...draft, note: e.target.value })} />
      </label>
      <p className="muted small">
        {draft.pin
          ? `Pinned at ${draft.pin.lat.toFixed(4)}, ${draft.pin.lng.toFixed(4)}`
          : 'No pin yet: search above or click the map.'}
      </p>
      <div className="actions">
        <button type="submit" className="button" disabled={busy || !draft.pin}>
          {busy ? 'Saving…' : 'Save place'}
        </button>
        <button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

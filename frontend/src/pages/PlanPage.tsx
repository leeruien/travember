import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Book } from '../api'
import { useAuth } from '../auth'
import { formatDate, formatDateRange } from '../format'
import { describeStep, planTrip, type Itinerary } from '../planner'
import { TripMap, type Pin } from '../components/TripMap'

const EXAMPLES = [
  '4 days in Kyoto in mid-November. I love temples, gardens and street food.',
  'A long weekend in Lisbon next month, flying from London. Good views and seafood.',
  'A week in Iceland in March: waterfalls, hot springs and a chance of northern lights.',
]

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

type SaveTo = 'existing' | 'new' | 'draft'

/** Describe a trip, watch the agent research it, then save the plan into one of your books as a chapter. */
export function PlanPage() {
  const { session } = useAuth()
  const me = session!.user.id // behind RequireAuth
  const navigate = useNavigate()

  const [request, setRequest] = useState('')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const [books, setBooks] = useState<Book[] | null>(null)
  const [saveTo, setSaveTo] = useState<SaveTo>('draft')
  const [bookId, setBookId] = useState('')
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookPrivate, setNewBookPrivate] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => () => abort.current?.abort(), []) // stop planning if the page is left
  useEffect(() => {
    api.listBooks({ ownerId: me }).then((b) => {
      setBooks(b)
      setBookId(b[0]?.id ?? '')
      if (b.length > 0) setSaveTo('existing')
    }, () => setBooks([]))
  }, [me])

  async function plan(e: FormEvent) {
    e.preventDefault()
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setRunning(true)
    setSteps([])
    setItinerary(null)
    setError(null)
    setSaveError(null)
    try {
      await planTrip(request, (event) => {
        if (event.type === 'tool') setSteps((s) => [...s, describeStep(event.name, event.input)])
        else if (event.type === 'itinerary') {
          setItinerary(event.itinerary)
          setNewBookTitle(event.itinerary.title)
        }
        else if (event.type === 'error') setError(event.message)
      }, controller.signal)
    } catch (err) {
      if (!controller.signal.aborted) setError((err as Error).message)
    } finally {
      if (abort.current === controller) setRunning(false)
    }
  }

  function stop() {
    abort.current?.abort()
    setRunning(false)
  }

  /**
   * The plan becomes a chapter, and every stop a page you can add photos and a write-up to later. The
   * chapter goes in one of your books, in a book started for it, or nowhere yet (a draft).
   */
  async function save() {
    if (!itinerary || (saveTo === 'existing' && !bookId)) return
    setSaving(true)
    setSaveError(null)
    try {
      const targetBook =
        saveTo === 'existing' ? bookId
        : saveTo === 'new' ? (await api.createBook({
            title: (newBookTitle.trim() || itinerary.title).slice(0, 200),
            description: itinerary.summary.slice(0, 2000),
            coverUrl: '',
            isPrivate: newBookPrivate,
          })).id
        : undefined
      const start = isDay(itinerary.start_date) ? itinerary.start_date : null
      const end = isDay(itinerary.end_date) && (!start || itinerary.end_date >= start) ? itinerary.end_date : null
      const summary = [itinerary.summary, itinerary.getting_there && `Getting there: ${itinerary.getting_there}`,
        itinerary.tips.length > 0 && `Tips:\n${itinerary.tips.map((t) => `• ${t}`).join('\n')}`]
        .filter(Boolean).join('\n\n')
      const chapter = await api.createDestination({
        bookId: targetBook, title: itinerary.title.slice(0, 200), country: itinerary.country.slice(0, 120),
        summary: summary.slice(0, 5000), coverImageUrl: '', startDate: start, endDate: end,
      })
      for (const day of itinerary.days) {
        for (const stop of day.stops) {
          if (Math.abs(stop.lat) > 90 || Math.abs(stop.lng) > 180) continue
          await api.addPlace(chapter.id, {
            name: stop.name.slice(0, 200),
            note: `${stop.time}: ${stop.description}`.slice(0, 5000),
            latitude: stop.lat,
            longitude: stop.lng,
            visitedOn: isDay(day.date) ? day.date : null,
            media: [],
          })
        }
      }
      navigate(`/chapters/${chapter.id}`)
    } catch (e) {
      setSaveError((e as Error).message)
      setSaving(false)
    }
  }

  const stops = itinerary?.days.flatMap((d, di) => d.stops.map((s) => ({ ...s, day: di + 1 }))) ?? []
  // Pins are numbered through the whole trip, so each day's list starts where the last one ended.
  const firstPin = itinerary?.days.map((_, di) => itinerary.days.slice(0, di).reduce((n, d) => n + d.stops.length, 0)) ?? []
  const pins: Pin[] = stops.map((s, i) => ({
    id: String(i),
    lat: s.lat,
    lng: s.lng,
    label: String(i + 1),
    title: s.name,
    subtitle: `Day ${s.day} · ${s.time}`,
  }))

  return (
    <div className="planner">
      <section className="planner-head">
        <p className="eyebrow">Trip planner</p>
        <h1>Plan a trip</h1>
        <p className="muted">
          Describe a trip and an AI agent researches it for you: real places and their coordinates, the
          weather for your dates, travel times, and pages other travellers have written. Then save the plan
          into one of your books.
        </p>
      </section>

      <form className="card planner-form" onSubmit={plan}>
        <label>
          Where to, and what do you like?
          <textarea rows={4} required minLength={10} maxLength={2000} value={request} disabled={running}
            placeholder={EXAMPLES[0]} onChange={(e) => setRequest(e.target.value)} />
        </label>
        <div className="planner-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" disabled={running} onClick={() => setRequest(ex)}>{ex}</button>
          ))}
        </div>
        <div className="actions">
          {running ? (
            <button type="button" className="button button--ghost" onClick={stop}>Stop</button>
          ) : (
            <button type="submit" className="button" disabled={request.trim().length < 10}>✨ Plan my trip</button>
          )}
        </div>
      </form>

      {(running || steps.length > 0) && (
        <section className="planner-steps" aria-live="polite">
          <h2 className="visually-hidden">Progress</h2>
          <ol>
            {steps.map((s, i) => <li key={i}>{s}</li>)}
            {running && <li className="planner-working">{steps.length === 0 ? 'Reading your request…' : 'Thinking…'}</li>}
          </ol>
        </section>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {itinerary && (
        <article className="itinerary">
          <header>
            <p className="eyebrow">{[itinerary.country, isDay(itinerary.start_date) &&
              formatDateRange(itinerary.start_date, isDay(itinerary.end_date) ? itinerary.end_date : null)].filter(Boolean).join(' · ')}</p>
            <h2>{itinerary.title}</h2>
            <p className="summary">{itinerary.summary}</p>
            {itinerary.getting_there && <p className="muted"><strong>Getting there.</strong> {itinerary.getting_there}</p>}
          </header>

          {pins.length > 0 && <TripMap pins={pins} route />}

          <ol className="itinerary-days">
            {itinerary.days.map((day, di) => (
              <li key={di} className="card itinerary-day">
                <h3>
                  Day {di + 1}{isDay(day.date) && ` · ${formatDate(day.date)}`}
                  <span className="muted"> · {day.theme}</span>
                </h3>
                {day.weather && <p className="muted small">🌦 {day.weather}</p>}
                <ol className="itinerary-stops">
                  {day.stops.map((s, si) => (
                    <li key={si}>
                      <span className="place-num">{firstPin[di] + si + 1}</span>
                      <div>
                        <p><strong>{s.name}</strong> <span className="muted small">· {s.time}</span></p>
                        <p className="muted">{s.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>

          {itinerary.tips.length > 0 && (
            <section>
              <h3>Tips</h3>
              <ul className="itinerary-tips">{itinerary.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </section>
          )}

          <section className="card itinerary-save">
            <h3>Keep this plan</h3>
            <p className="muted small">It becomes a chapter, with each stop as a page you can add photos and a write-up to later.</p>
            <fieldset className="save-options" disabled={saving}>
              <legend className="visually-hidden">Where to save it</legend>

              <div className="save-option">
                <label className="checkbox">
                  <input type="radio" name="save-to" checked={saveTo === 'existing'} disabled={!books?.length}
                    onChange={() => setSaveTo('existing')} />
                  <span>
                    <strong>In one of my books</strong>
                    {books?.length === 0 && <span className="muted small">You haven't started a book yet.</span>}
                  </span>
                </label>
                {saveTo === 'existing' && (
                  <select value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Book to save into">
                    {books?.map((b) => <option key={b.id} value={b.id}>{b.title}{b.isPrivate ? ' 🔒' : ''}</option>)}
                  </select>
                )}
              </div>

              <div className="save-option">
                <label className="checkbox">
                  <input type="radio" name="save-to" checked={saveTo === 'new'} onChange={() => setSaveTo('new')} />
                  <span><strong>In a new book of its own</strong></span>
                </label>
                {saveTo === 'new' && (
                  <div className="save-option-fields">
                    <input maxLength={200} value={newBookTitle} aria-label="New book's title"
                      placeholder={itinerary.title} onChange={(e) => setNewBookTitle(e.target.value)} />
                    <label className="checkbox">
                      <input type="checkbox" checked={newBookPrivate} onChange={(e) => setNewBookPrivate(e.target.checked)} />
                      <span className="small">🔒 Private: only you can see it</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="save-option">
                <label className="checkbox">
                  <input type="radio" name="save-to" checked={saveTo === 'draft'} onChange={() => setSaveTo('draft')} />
                  <span>
                    <strong>As a draft, in no book yet</strong>
                    <span className="muted small">Only you can see it. Move it into a book whenever you like, from the chapter.</span>
                  </span>
                </label>
              </div>
            </fieldset>
            <button className="button" onClick={save} disabled={saving || (saveTo === 'existing' && !bookId)}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
            {saveError && <p className="error" role="alert">{saveError}</p>}
          </section>
        </article>
      )}
    </div>
  )
}

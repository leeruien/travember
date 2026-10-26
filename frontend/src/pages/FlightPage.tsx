import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Destination } from '../api'
import { useAuth } from '../auth'
import { formatDate, formatDateRange } from '../format'
import { ErrorNote, Loading } from '../components/Status'
import { FlightMap, type Stop } from '../components/FlightMap'

/** Every page of the given chapters as stops, by date. Undated pages go last, in book order. */
function toStops(chapters: Destination[]): Stop[] {
  const stops = chapters.flatMap((d) =>
    d.places.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.latitude,
      lng: p.longitude,
      date: p.visitedOn,
      chapterTitle: d.title,
      href: `/chapters/${d.id}/pages/${p.id}`,
      thumb: p.media.find((m) => m.kind === 'image') ?? p.media[0] ?? null,
    })),
  )
  // sort() is stable, so pages on the same day (and undated ones) keep their book order.
  return stops.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date)
    return a.date ? -1 : b.date ? 1 : 0
  })
}

/** What the journey covers, and how to get back to it. */
interface Scope {
  chapters: Destination[]
  title: string | null
  eyebrow: string
  back: { to: string; label: string }
}

/**
 * The journey map: every page on one map, flown through in date order. It covers one trip at
 * /chapters/:id/journey, one book at /books/:bookId/journey, and everything a person has written at
 * /travellers/:userId/journey.
 */
export function FlightPage() {
  const { id, bookId, userId } = useParams()
  const { session } = useAuth()
  const [scope, setScope] = useState<Scope | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setScope(null)
    const load: Promise<Scope> = id
      ? api.getDestination(id).then((d) => ({
          chapters: [d],
          title: d.title,
          eyebrow: 'Fly through this trip',
          back: { to: `/chapters/${d.id}`, label: d.title },
        }))
      : bookId
        ? api.getBook(bookId).then((b) => ({
            chapters: b.chapters,
            title: b.title,
            eyebrow: `A travel book by ${b.authorName}`,
            back: { to: `/books/${b.id}`, label: b.title },
          }))
        : api.listDestinations(userId ?? '').then((chapters) => ({
            chapters,
            title: null, // "Your journey" or not depends on who's signed in, which can change after loading
            eyebrow: 'Journey map',
            back: { to: '/', label: 'The shelf' },
          }))
    load.then(setScope, (e: Error) => setError(e.message))
  }, [id, bookId, userId])

  const stops = useMemo(() => (scope ? toStops(scope.chapters) : []), [scope])

  if (error) {
    return (
      <ErrorNote title="Not found" message={error}>
        <Link to="/">← Back to the shelf</Link>
      </ErrorNote>
    )
  }
  if (!scope) return <Loading />

  const mine = userId !== undefined && userId === session?.user.id
  const dated = stops.filter((s) => s.date)
  const span = dated.length > 0 ? formatDateRange(dated[0].date, dated[dated.length - 1].date) : null
  const oneChapter = scope.chapters.length === 1 && id !== undefined

  return (
    <section className="journey">
      <Link to={scope.back.to}>← {scope.back.label}</Link>
      <p className="eyebrow journey-eyebrow">{scope.eyebrow}</p>
      <h1>{scope.title ?? (mine ? 'Your journey' : "A traveller's journey")}</h1>
      <p className="muted">
        {[`${stops.length} ${stops.length === 1 ? 'place' : 'places'}`, span].filter(Boolean).join(' · ')}
      </p>

      {stops.length === 0 ? (
        <p className="muted">
          No pages yet. {mine && <>Write a chapter and add pages to it, and they'll appear here.</>}
        </p>
      ) : (
        <>
          <FlightMap stops={stops} />
          <h2 className="journey-itinerary-title">Itinerary</h2>
          <ol className="itinerary">
            {stops.map((s, i) => (
              <li key={s.id}>
                <span className="place-num">{i + 1}</span>
                <Link to={s.href}>{s.name}</Link>
                <span className="muted small">
                  {s.date ? formatDate(s.date) : 'Undated'}
                  {!oneChapter && ` · ${s.chapterTitle}`}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

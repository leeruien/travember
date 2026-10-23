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

/**
 * The journey map: every page on one map, flown through in date order. At /chapters/:id/journey it covers
 * one trip; at /travellers/:userId/journey, every trip that person has written.
 */
export function FlightPage() {
  const { id, userId } = useParams()
  const { session } = useAuth()
  const [chapters, setChapters] = useState<Destination[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listDestinations().then(setChapters, (e: Error) => setError(e.message))
  }, [])

  const chapter = id ? chapters?.find((d) => d.id === id) : undefined
  const stops = useMemo(
    () => (chapters ? toStops(id ? chapters.filter((d) => d.id === id) : chapters.filter((d) => d.ownerId === userId)) : []),
    [chapters, id, userId],
  )

  if (error) return <ErrorNote message={error} />
  if (!chapters) return <Loading />
  if (id && !chapter) {
    return (
      <ErrorNote title="Chapter not found" message="It may have been removed from the book.">
        <Link to="/">← Back to contents</Link>
      </ErrorNote>
    )
  }

  const mine = !id && userId === session?.user.id
  const dated = stops.filter((s) => s.date)
  const span = dated.length > 0 ? formatDateRange(dated[0].date, dated[dated.length - 1].date) : null

  return (
    <section className="journey">
      <Link to={chapter ? `/chapters/${chapter.id}` : '/'}>← {chapter ? chapter.title : 'Contents'}</Link>
      <p className="eyebrow journey-eyebrow">{chapter ? 'Fly through this trip' : 'Journey map'}</p>
      <h1>{chapter ? chapter.title : mine ? 'Your journey' : "A traveller's journey"}</h1>
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
                  {!chapter && ` · ${s.chapterTitle}`}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

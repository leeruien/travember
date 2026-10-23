import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Destination } from '../api'
import { useAuth } from '../auth'
import { formatDateRange } from '../format'
import { ErrorNote, Loading } from '../components/Status'
import { TripMap, type Pin } from '../components/TripMap'

/** The cover and table of contents: every chapter, and every pin on one atlas map. */
export function BookPage() {
  const { session } = useAuth()
  const [chapters, setChapters] = useState<Destination[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listDestinations().then(setChapters, (e: Error) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!chapters) return <Loading />

  const pins: Pin[] = chapters.flatMap((d, i) =>
    d.places.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      label: String(i + 1),
      title: p.name,
      subtitle: `Chapter ${i + 1} · ${d.title}`,
      href: `/chapters/${d.id}`,
    })),
  )
  const countries = new Set(chapters.map((d) => d.country?.trim().toLowerCase()).filter(Boolean))

  return (
    <>
      <section className="cover">
        <p className="eyebrow">Travember</p>
        <h1>Every trip is a chapter.<br />Every place is a pin.</h1>
        <dl className="stats">
          <div><dt>Chapters</dt><dd>{chapters.length}</dd></div>
          <div><dt>Places</dt><dd>{pins.length}</dd></div>
          <div><dt>Countries</dt><dd>{countries.size}</dd></div>
        </dl>
        {session ? (
          <div className="actions">
            <Link className="button" to="/chapters/new">Write a new chapter</Link>
            <Link className="button button--ghost" to={`/travellers/${session.user.id}/journey`}>✈ Fly through my journey</Link>
          </div>
        ) : (
          <p className="muted"><Link to="/login">Sign in</Link> to write your own chapters.</p>
        )}
      </section>

      {pins.length > 0 && <TripMap pins={pins} className="map--atlas" />}

      <section>
        <h2>Contents</h2>
        {chapters.length === 0 ? (
          <p className="muted">No chapters yet. The first trip you add becomes chapter one.</p>
        ) : (
          <ol className="toc">
            {chapters.map((d, i) => (
              <li key={d.id}>
                <Link to={`/chapters/${d.id}`} className="toc-entry">
                  <span className="toc-num">{i + 1}</span>
                  {d.coverImageUrl ? (
                    <img className="toc-thumb" src={d.coverImageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="toc-thumb toc-thumb--blank" aria-hidden="true">📍</span>
                  )}
                  <span className="toc-text">
                    <span className="toc-title">{d.title}</span>
                    <span className="muted small">
                      {[d.country, formatDateRange(d.startDate, d.endDate)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="muted small toc-count">
                    {d.places.length} {d.places.length === 1 ? 'place' : 'places'}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}

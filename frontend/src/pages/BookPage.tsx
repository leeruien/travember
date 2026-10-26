import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type BookDetail } from '../api'
import { useAuth } from '../auth'
import { formatDateRange } from '../format'
import { ErrorNote, Loading } from '../components/Status'
import { BookCover } from '../components/BookCover'
import { TripMap, type Pin } from '../components/TripMap'

/** A book opened: its cover, the contents page, and every place in it on one map. */
export function BookPage() {
  const { bookId = '' } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [book, setBook] = useState<BookDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setBook(null)
    api.getBook(bookId).then(setBook, (e: Error) => setError(e.message))
  }, [bookId])

  if (error) {
    return (
      <ErrorNote title="Book not found" message={error}>
        <Link to="/">← Back to the shelf</Link>
      </ErrorNote>
    )
  }
  if (!book) return <Loading />

  const isOwner = session?.user.id === book.ownerId
  const pins: Pin[] = book.chapters.flatMap((d, i) =>
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
  const countries = new Set(book.chapters.map((d) => d.country?.trim().toLowerCase()).filter(Boolean))

  async function deleteBook() {
    if (!book || !confirm(`Delete “${book.title}” with all of its chapters and pages? This can't be undone.`)) return
    setBusy(true)
    setActionError(null)
    try {
      await api.deleteBook(book.id)
      navigate('/me')
    } catch (e) {
      setActionError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <section className="book-hero">
        <div className="book-hero-cover">
          <BookCover book={book} size="lg" />
        </div>
        <div className="book-hero-text">
          <p className="eyebrow">A travel book by {book.authorName}</p>
          <h1>{book.title}</h1>
          {book.description && <p className="summary">{book.description}</p>}
          <dl className="stats">
            <div><dt>Chapters</dt><dd>{book.chapterCount}</dd></div>
            <div><dt>Pages</dt><dd>{book.pageCount}</dd></div>
            <div><dt>Countries</dt><dd>{countries.size}</dd></div>
          </dl>
          <div className="actions">
            {book.pageCount > 0 && <Link className="button" to={`/books/${book.id}/journey`}>✈ Fly through this book</Link>}
            {isOwner && (
              <>
                <Link className="button button--ghost" to={`/books/${book.id}/chapters/new`}>Write a new chapter</Link>
                <Link className="button button--ghost" to={`/books/${book.id}/edit`}>Edit book</Link>
                <button className="button button--danger" onClick={deleteBook} disabled={busy}>Delete</button>
              </>
            )}
          </div>
          {isOwner && !book.customCoverUrl && (
            <p className="muted small">
              {book.coverUrl
                ? 'The cover is your first photo for now. Choose your own in “Edit book”.'
                : 'Choose a cover in “Edit book”, or add photos to your pages and the first one becomes the cover.'}
            </p>
          )}
          {actionError && <p className="error" role="alert">{actionError}</p>}
        </div>
      </section>

      <section>
        <h2>Contents</h2>
        {book.chapters.length === 0 ? (
          <p className="muted">
            No chapters yet.{isOwner && ' Write the first one: each trip you take is a chapter.'}
          </p>
        ) : (
          <ol className="toc">
            {book.chapters.map((d, i) => (
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
                    {d.places.length} {d.places.length === 1 ? 'page' : 'pages'}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {pins.length > 0 && (
        <section>
          <h2>Everywhere in this book</h2>
          <TripMap pins={pins} />
        </section>
      )}
    </>
  )
}

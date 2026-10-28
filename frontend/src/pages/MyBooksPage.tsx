import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Book, type Destination } from '../api'
import { useAuth } from '../auth'
import { formatDateRange } from '../format'
import { ErrorNote, Loading } from '../components/Status'
import { BookCover } from '../components/BookCover'

/** Your own desk: every book you're writing, each with its chapters and the ways to add to it. */
export function MyBooksPage() {
  const { session } = useAuth()
  const me = session!.user.id // behind RequireAuth
  const [books, setBooks] = useState<Book[] | null>(null)
  const [chapters, setChapters] = useState<Destination[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.listBooks({ ownerId: me }), api.listDestinations(me)]).then(([b, c]) => {
      setBooks(b)
      setChapters(c)
    }, (e: Error) => setError(e.message))
  }, [me])

  if (error) return <ErrorNote message={error} />
  if (!books) return <Loading />

  const pages = books.reduce((n, b) => n + b.pageCount, 0)
  const drafts = chapters.filter((d) => d.bookId === null)

  return (
    <>
      <section className="mine-head">
        <div>
          <h1>Your books</h1>
          <p className="muted">
            {books.length} {books.length === 1 ? 'book' : 'books'} · {chapters.length}{' '}
            {chapters.length === 1 ? 'chapter' : 'chapters'} · {pages} {pages === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <div className="actions">
          <Link className="button" to="/books/new">Start a new book</Link>
          <Link className="button button--ghost" to="/plan">✨ Plan a trip</Link>
          {pages > 0 && <Link className="button button--ghost" to={`/travellers/${me}/journey`}>✈ My journey</Link>}
        </div>
      </section>

      {drafts.length > 0 && (
        <section className="mine-drafts">
          <h2>Drafts</h2>
          <p className="muted small">Chapters that aren't in a book yet, like saved trip plans. Only you can see them.</p>
          <ol className="mine-chapters">
            {drafts.map((d) => (
              <li key={d.id}>
                <span className="place-num" aria-hidden="true">✎</span>
                <Link to={`/chapters/${d.id}`}>{d.title}</Link>
                <span className="muted small">
                  {[d.country, formatDateRange(d.startDate, d.endDate),
                    `${d.places.length} ${d.places.length === 1 ? 'page' : 'pages'}`].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {books.length === 0 ? (
        <div className="card status">
          <h2>Your shelf is empty</h2>
          <p className="muted">Start a book, then add a chapter for each trip and a page for each place.</p>
          <Link className="button" to="/books/new">Start your first book</Link>
        </div>
      ) : (
        <ul className="mine-books">
          {books.map((b) => {
            const own = chapters.filter((d) => d.bookId === b.id) // already in book order
            return (
              <li key={b.id} className="mine-book">
                <Link to={`/books/${b.id}`} className="mine-book-cover" aria-label={`Open ${b.title}`}>
                  <BookCover book={b} />
                </Link>
                <div className="mine-book-body">
                  <h2>
                    <Link to={`/books/${b.id}`}>{b.title}</Link>
                    {b.isPrivate && <span className="badge" title="Only you can see this book">🔒 Private</span>}
                  </h2>
                  <p className="muted small">
                    {b.chapterCount} {b.chapterCount === 1 ? 'chapter' : 'chapters'} · {b.pageCount}{' '}
                    {b.pageCount === 1 ? 'page' : 'pages'}
                  </p>
                  {own.length === 0 ? (
                    <p className="muted">No chapters yet.</p>
                  ) : (
                    <ol className="mine-chapters">
                      {own.map((d, i) => (
                        <li key={d.id}>
                          <span className="place-num">{i + 1}</span>
                          <Link to={`/chapters/${d.id}`}>{d.title}</Link>
                          <span className="muted small">
                            {[d.country, formatDateRange(d.startDate, d.endDate),
                              `${d.places.length} ${d.places.length === 1 ? 'page' : 'pages'}`].filter(Boolean).join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="actions">
                    <Link className="button" to={`/books/${b.id}/chapters/new`}>Write a new chapter</Link>
                    <Link className="button button--ghost" to={`/books/${b.id}/edit`}>Edit book</Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

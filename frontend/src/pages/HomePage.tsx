import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Book } from '../api'
import { useAuth } from '../auth'
import { ErrorNote, Loading } from '../components/Status'
import { BookShelf } from '../components/BookCover'

/**
 * The shelf of everyone else's books, newest first, with a search. Signed-in readers find their own books
 * under "My books" instead. The query lives in the URL (?q=) so a search can be shared.
 */
export function HomePage() {
  const { session, loading: authLoading } = useAuth()
  const me = session?.user.id
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [input, setInput] = useState(query)
  const [books, setBooks] = useState<Book[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Search a moment after typing stops, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = input.trim()
      if (q !== query) setParams(q ? { q } : {}, { replace: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [input, query, setParams])

  useEffect(() => {
    if (authLoading) return // wait to know whose books to leave out
    let current = true
    api.listBooks({ q: query, excludeOwnerId: me }).then(
      (b) => {
        if (!current) return
        setBooks(b)
        setError(null)
      },
      (e: Error) => {
        if (current) setError(e.message)
      },
    )
    return () => {
      current = false // a slower, older search mustn't overwrite a newer one
    }
  }, [query, me, authLoading])

  return (
    <>
      <section className="shelf-head">
        <div>
          <h1 className="shelf-heading">{me ? 'From other travellers' : 'Travel books'}</h1>
          <p className="muted shelf-intro">One trip to a chapter, one place to a page.</p>
        </div>
        <form className="shelf-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <input
            type="search"
            placeholder="Search books, authors, places…"
            aria-label="Search books, authors and places"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21" />
          </svg>
        </form>
      </section>

      {!me && (
        <p className="muted shelf-actions"><Link to="/login">Sign in</Link> to write your own book. Anyone can read.</p>
      )}

      {error ? (
        <ErrorNote message={error} />
      ) : !books ? (
        <Loading />
      ) : books.length === 0 ? (
        <p className="status muted">
          {query
            ? `No books match “${query}”.`
            : me
              ? 'Nobody else has written a book yet.'
              : 'The shelf is empty. The first book written will go here.'}
        </p>
      ) : (
        <BookShelf books={books} />
      )}
    </>
  )
}

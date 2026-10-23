import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Destination, type Place } from '../api'
import { formatCoords, formatDate } from '../format'
import { ErrorNote, Loading } from '../components/Status'
import { MediaGallery } from '../components/MediaGallery'
import { Comments, LikeButton } from '../components/Social'

/** A page turn in progress: the page we came from, and which way we're going. */
interface Turn {
  fromId: string
  direction: 'next' | 'prev'
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Reads a chapter one page at a time, turning pages like a book. */
export function PageReader() {
  const { id = '', pageId = '' } = useParams()
  const navigate = useNavigate()

  const [chapter, setChapter] = useState<Destination | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shownId, setShownId] = useState(pageId)
  const [turn, setTurn] = useState<Turn | null>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    api.getDestination(id).then(setChapter, (e: Error) => setLoadError(e.message))
  }, [id])

  const pages = chapter?.places ?? []
  const index = pages.findIndex((p) => p.id === pageId)

  // Start the turn while rendering the new page rather than in an effect afterwards, so the turning
  // leaf is there from the first frame instead of the new page flashing up underneath it first.
  if (pageId !== shownId) {
    const from = pages.findIndex((p) => p.id === shownId)
    setShownId(pageId)
    setTurn(from >= 0 && index >= 0 && !prefersReducedMotion()
      ? { fromId: shownId, direction: index > from ? 'next' : 'prev' }
      : null)
  }

  function go(delta: number) {
    const target = pages[index + delta]
    // Replace, so Back leaves the book instead of stepping back through every page.
    if (target) navigate(`/chapters/${id}/pages/${target.id}`, { replace: true })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, video')) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (loadError) return <ErrorNote message={loadError} />
  if (!chapter) return <Loading />
  if (index < 0) {
    return (
      <ErrorNote title="Page not found" message="It may have been torn out of this chapter.">
        <Link to={`/chapters/${id}`}>← Back to the chapter</Link>
      </ErrorNote>
    )
  }

  const page = pages[index]
  const from = turn ? pages.find((p) => p.id === turn.fromId) : undefined
  // Turning forward, the old page lifts off the new one. Turning back, the new page comes down over the old.
  const below = turn?.direction === 'prev' && from ? from : page
  const turning = turn && from ? (turn.direction === 'next' ? from : page) : null

  function patch(changes: Partial<Place>) {
    setChapter((c) => c && { ...c, places: c.places.map((p) => (p.id === page.id ? { ...p, ...changes } : p)) })
  }

  return (
    <div className="reader">
      <nav className="reader-top">
        <Link to={`/chapters/${id}`}>← {chapter.title}</Link>
        <span className="muted small">Page {index + 1} of {pages.length}</span>
      </nav>

      <div
        className="book"
        onTouchStart={(e) => {
          // Swipes inside the photo strip scroll the photos, not the book.
          touchStartX.current = (e.target as HTMLElement).closest('.gallery') ? null : e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return
          const dx = e.changedTouches[0].clientX - touchStartX.current
          if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
          touchStartX.current = null
        }}
      >
        <PageLeaf page={below} number={pages.indexOf(below) + 1} chapterTitle={chapter.title} />
        {turning && turn && (
          <PageLeaf
            key={`${turn.fromId}>${page.id}`}
            page={turning}
            number={pages.indexOf(turning) + 1}
            chapterTitle={chapter.title}
            turn={turn.direction}
            onTurned={() => setTurn(null)}
          />
        )}
      </div>

      <div className="reader-nav">
        <button className="button button--ghost" onClick={() => go(-1)} disabled={index === 0}>← Previous</button>
        <button className="button button--ghost" onClick={() => go(1)} disabled={index === pages.length - 1}>
          Next page →
        </button>
      </div>

      <div className="page-social">
        <LikeButton key={`like-${page.id}`} place={page} onChange={(s) => patch(s)} />
        <Comments
          key={`comments-${page.id}`}
          placeId={page.id}
          pageOwnerId={chapter.ownerId}
          onCountChange={(commentCount) => patch({ commentCount })}
        />
      </div>
    </div>
  )
}

function PageLeaf({ page, number, chapterTitle, turn, onTurned }: {
  page: Place
  number: number
  chapterTitle: string
  turn?: 'next' | 'prev'
  onTurned?: () => void
}) {
  return (
    <article
      className={`leaf ${turn ? `leaf--turning leaf--${turn}` : ''}`}
      // The turning leaf is a copy of a page that's also on screen, so keep it away from screen readers and tabbing.
      aria-hidden={turn ? true : undefined}
      inert={turn ? true : undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onTurned?.()
      }}
    >
      <MediaGallery media={page.media} />
      <div className="leaf-text">
        <p className="eyebrow">{chapterTitle}</p>
        <h1 className="leaf-title">{page.name}</h1>
        <p className="muted small">
          📍 {formatCoords(page.latitude, page.longitude)}
          {page.visitedOn && ` · ${formatDate(page.visitedOn)}`}
        </p>
        {page.note && <p className="leaf-writeup">{page.note}</p>}
      </div>
      <p className="folio">{number}</p>
    </article>
  )
}

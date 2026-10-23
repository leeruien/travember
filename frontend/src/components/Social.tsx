import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, type Comment, type LikeState, type Place } from '../api'
import { useAuth } from '../auth'
import { formatTimestamp } from '../format'

/** Mount with `key={place.id}` so it starts fresh for each page. */
export function LikeButton({ place, onChange }: { place: Place; onChange?: (state: LikeState) => void }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<LikeState>({ likeCount: place.likeCount, likedByMe: place.likedByMe })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    if (!session) {
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    const before = state
    // Show the change straight away; put it back if the API says no.
    setState({ likedByMe: !before.likedByMe, likeCount: before.likeCount + (before.likedByMe ? -1 : 1) })
    setBusy(true)
    setError(null)
    try {
      const saved = before.likedByMe ? await api.unlikePlace(place.id) : await api.likePlace(place.id)
      setState(saved)
      onChange?.(saved)
    } catch (e) {
      setState(before)
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="like">
      <button
        className={`like-button ${state.likedByMe ? 'is-liked' : ''}`}
        aria-pressed={state.likedByMe}
        onClick={toggle}
        disabled={busy}
      >
        <span aria-hidden="true">{state.likedByMe ? '♥' : '♡'}</span>
        {state.likeCount} {state.likeCount === 1 ? 'like' : 'likes'}
      </button>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  )
}

/** Mount with `key={placeId}` so it starts fresh for each page. */
export function Comments({ placeId, pageOwnerId, onCountChange }: {
  placeId: string
  pageOwnerId: string
  onCountChange?: (count: number) => void
}) {
  const { session } = useAuth()
  const location = useLocation()
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listComments(placeId).then(setComments, (e: Error) => setLoadError(e.message))
  }, [placeId])

  function update(next: Comment[]) {
    setComments(next)
    onCountChange?.(next.length)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!comments || !body.trim()) return
    setBusy(true)
    setError(null)
    try {
      update([...comments, await api.addComment(placeId, body)])
      setBody('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(c: Comment) {
    if (!comments || !confirm('Delete this comment?')) return
    setError(null)
    try {
      await api.deleteComment(c.id)
      update(comments.filter((x) => x.id !== c.id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const me = session?.user.id

  return (
    <section className="comments" aria-labelledby="comments-title">
      <h2 id="comments-title">Comments{comments && comments.length > 0 && ` (${comments.length})`}</h2>
      {loadError && <p className="error">{loadError}</p>}
      {comments && comments.length === 0 && <p className="muted">No comments yet.</p>}
      {comments && comments.length > 0 && (
        <ol className="comment-list">
          {comments.map((c) => (
            <li key={c.id}>
              <p className="comment-meta">
                <strong>{c.authorName}</strong>
                <time className="muted small" dateTime={c.createdAt}>{formatTimestamp(c.createdAt)}</time>
                {(c.authorId === me || pageOwnerId === me) && (
                  <button className="link link--danger small" onClick={() => remove(c)}>Delete</button>
                )}
              </p>
              <p className="comment-body">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {session ? (
        <form className="comment-form" onSubmit={submit}>
          <label>
            Leave a comment
            <textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div>
            <button type="submit" className="button" disabled={busy || !body.trim()}>
              {busy ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted"><Link to="/login" state={{ from: location.pathname }}>Sign in</Link> to leave a comment.</p>
      )}
    </section>
  )
}

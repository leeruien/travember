import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type BookDetail, type BookInput } from '../api'
import { useAuth } from '../auth'
import { uploadMedia } from '../media'
import { ErrorNote, Loading } from '../components/Status'
import { BookCover } from '../components/BookCover'

const empty: BookInput = { title: '', description: '', coverUrl: '' }

/** The book's first photo, in book order: what readers see when the author hasn't chosen a cover. */
function firstPhoto(book: BookDetail) {
  for (const d of book.chapters) {
    for (const p of d.places) {
      const image = p.media.find((m) => m.kind === 'image')
      if (image) return image.url
    }
  }
  return null
}

/** Start a book (/books/new) or edit one you wrote (/books/:bookId/edit). */
export function BookForm() {
  const { bookId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<BookInput>(empty)
  const [book, setBook] = useState<BookDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bookId) return
    api.getBook(bookId).then(
      (b) => {
        setBook(b)
        setForm({ title: b.title, description: b.description ?? '', coverUrl: b.customCoverUrl ?? '' })
      },
      (e: Error) => setLoadError(e.message),
    )
  }, [bookId])

  if (loadError) return <ErrorNote message={loadError} />
  if (bookId && !book) return <Loading />
  if (book && book.ownerId !== session?.user.id) {
    return (
      <ErrorNote title="Not your book" message="Only the author of this book can edit it.">
        <Link to={`/books/${book.id}`}>← Back to the book</Link>
      </ErrorNote>
    )
  }

  const meta = session?.user.user_metadata as { display_name?: string } | undefined
  const authorName = book?.authorName ?? meta?.display_name ?? session?.user.email?.split('@')[0] ?? ''
  const fallback = book ? firstPhoto(book) : null

  function set<K extends keyof BookInput>(key: K, value: BookInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function pickCover(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('The cover has to be a photo.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      set('coverUrl', (await uploadMedia(file)).url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const saved = bookId ? await api.updateBook(bookId, form) : await api.createBook(form)
      navigate(`/books/${saved.id}`)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form className="card form book-form" onSubmit={submit}>
      <h1>{bookId ? 'Edit book' : 'A new book'}</h1>
      <div className="book-form-body">
        <div className="book-form-cover">
          <BookCover book={{ id: bookId ?? 'new', title: form.title || 'Untitled', authorName, coverUrl: form.coverUrl || fallback }} />
          <label className="button button--ghost media-add" aria-disabled={uploading}>
            {uploading ? 'Uploading…' : form.coverUrl ? 'Change cover' : 'Choose a cover'}
            <input
              type="file"
              accept="image/*"
              className="visually-hidden"
              disabled={uploading}
              onChange={(e) => {
                pickCover(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {form.coverUrl && (
            <button type="button" className="link small" onClick={() => set('coverUrl', '')}>Remove cover</button>
          )}
          <p className="muted small">
            {form.coverUrl
              ? 'Your chosen cover.'
              : fallback
                ? 'No cover chosen, so the book shows its first photo.'
                : 'No cover chosen: the book gets a cloth cover until you add photos, then shows the first one.'}
          </p>
        </div>
        <div className="book-form-fields">
          <label>
            Title
            <input required maxLength={200} value={form.title} placeholder="Around the world in 2025"
              onChange={(e) => set('title', e.target.value)} />
          </label>
          <label>
            Description <span className="muted small">(optional)</span>
            <textarea rows={5} maxLength={2000} value={form.description} placeholder="What's this book about?"
              onChange={(e) => set('description', e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="actions">
            <button type="submit" className="button" disabled={saving || uploading}>
              {saving ? 'Saving…' : bookId ? 'Save changes' : 'Create book'}
            </button>
            <Link className="button button--ghost" to={bookId ? `/books/${bookId}` : '/me'}>Cancel</Link>
          </div>
          {!bookId && <p className="muted small">You'll write chapters, one per trip, once the book exists.</p>}
        </div>
      </div>
    </form>
  )
}

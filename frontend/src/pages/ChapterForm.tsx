import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Book, type DestinationInput } from '../api'
import { useAuth } from '../auth'
import { ErrorNote, Loading } from '../components/Status'

const empty: DestinationInput = { title: '', country: '', summary: '', coverImageUrl: '', startDate: null, endDate: null }

/**
 * Write a chapter into a book (/books/:bookId/chapters/new) or edit one you wrote (/chapters/:id/edit).
 * Editing can also move the chapter into another book, or a draft into its first book.
 */
export function ChapterForm() {
  const { id, bookId: newInBook } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const me = session?.user.id

  const [form, setForm] = useState<DestinationInput>(empty)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [currentBookId, setCurrentBookId] = useState<string | null>(null) // null: a draft
  const [books, setBooks] = useState<Book[] | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!me) return
    const chapter = id
      ? api.getDestination(id).then((d) => {
          setForm({
            bookId: d.bookId ?? undefined,
            title: d.title,
            country: d.country ?? '',
            summary: d.summary ?? '',
            coverImageUrl: d.coverImageUrl ?? '',
            startDate: d.startDate,
            endDate: d.endDate,
          })
          setOwnerId(d.ownerId)
          setCurrentBookId(d.bookId)
        })
      : api.getBook(newInBook ?? '').then((b) => {
          setForm({ ...empty, bookId: b.id })
          setOwnerId(b.ownerId)
          setCurrentBookId(b.id)
        })
    Promise.all([chapter, api.listBooks({ ownerId: me }).then(setBooks)]).then(
      () => setLoaded(true),
      (e: Error) => setLoadError(e.message),
    )
  }, [id, newInBook, me])

  if (loadError) return <ErrorNote message={loadError} />
  if (!loaded || !books) return <Loading />
  if (ownerId !== me) {
    return (
      <ErrorNote title="Not yours" message="Only its author can change this.">
        <Link to={id ? `/chapters/${id}` : '/'}>← Back</Link>
      </ErrorNote>
    )
  }

  function set<K extends keyof DestinationInput>(key: K, value: DestinationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('The trip ends before it starts. Check the dates.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = id ? await api.updateDestination(id, form) : await api.createDestination(form)
      navigate(`/chapters/${saved.id}`)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  const currentBook = books.find((b) => b.id === currentBookId)

  return (
    <form className="card form" onSubmit={submit}>
      <p className="eyebrow">{currentBook ? currentBook.title : 'Draft'}</p>
      <h1>{id ? 'Edit chapter' : 'A new chapter'}</h1>
      <label>
        Title
        <input required maxLength={200} value={form.title} placeholder="Autumn in Kyoto"
          onChange={(e) => set('title', e.target.value)} />
      </label>
      {id && (
        <label>
          Book
          <select value={form.bookId ?? ''} onChange={(e) => set('bookId', e.target.value || undefined)}>
            {/* A chapter can move into a book, but not back out to the drafts. */}
            {currentBookId === null && <option value="">No book yet (draft, only you can see it)</option>}
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}{b.isPrivate ? ' 🔒' : ''}</option>)}
          </select>
        </label>
      )}
      <label>
        Country
        <input maxLength={120} value={form.country} placeholder="Japan" onChange={(e) => set('country', e.target.value)} />
      </label>
      <div className="form-row">
        <label>
          From
          <input type="date" value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
        </label>
        <label>
          To
          <input type="date" value={form.endDate ?? ''} min={form.startDate ?? undefined}
            onChange={(e) => set('endDate', e.target.value || null)} />
        </label>
      </div>
      <label>
        Cover image URL
        <input type="url" maxLength={2000} value={form.coverImageUrl} placeholder="https://…"
          onChange={(e) => set('coverImageUrl', e.target.value)} />
      </label>
      {form.coverImageUrl && <img className="cover-preview" src={form.coverImageUrl} alt="Cover preview" />}
      <label>
        The story
        <textarea rows={6} maxLength={5000} value={form.summary} placeholder="What made this trip worth a chapter?"
          onChange={(e) => set('summary', e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create chapter'}
        </button>
        <Link className="button button--ghost" to={id ? `/chapters/${id}` : `/books/${currentBookId}`}>Cancel</Link>
      </div>
      {!id && <p className="muted small">You'll add pages, one per place, once the chapter exists.</p>}
    </form>
  )
}

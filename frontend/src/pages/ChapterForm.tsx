import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type DestinationInput } from '../api'
import { useAuth } from '../auth'
import { ErrorNote, Loading } from '../components/Status'

const empty: DestinationInput = { title: '', country: '', summary: '', coverImageUrl: '', startDate: null, endDate: null }

/** Write a chapter into a book (/books/:bookId/chapters/new) or edit one you wrote (/chapters/:id/edit). */
export function ChapterForm() {
  const { id, bookId: newInBook } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<DestinationInput>(empty)
  const [book, setBook] = useState<{ id: string; title: string; ownerId: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      api.getDestination(id).then(
        (d) => {
          setForm({
            title: d.title,
            country: d.country ?? '',
            summary: d.summary ?? '',
            coverImageUrl: d.coverImageUrl ?? '',
            startDate: d.startDate,
            endDate: d.endDate,
          })
          return api.getBook(d.bookId).then(setBook)
        },
      ).catch((e: Error) => setLoadError(e.message))
    } else if (newInBook) {
      api.getBook(newInBook).then(setBook, (e: Error) => setLoadError(e.message))
    }
  }, [id, newInBook])

  if (loadError) return <ErrorNote message={loadError} />
  if (!book) return <Loading />
  if (book.ownerId !== session?.user.id) {
    return (
      <ErrorNote title="Not your book" message="Only the author of this book can write in it.">
        <Link to={`/books/${book.id}`}>← Back to the book</Link>
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
      const saved = id ? await api.updateDestination(id, form) : await api.createDestination({ ...form, bookId: book!.id })
      navigate(`/chapters/${saved.id}`)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <p className="eyebrow">{book.title}</p>
      <h1>{id ? 'Edit chapter' : 'A new chapter'}</h1>
      <label>
        Title
        <input required maxLength={200} value={form.title} placeholder="Autumn in Kyoto"
          onChange={(e) => set('title', e.target.value)} />
      </label>
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
        <Link className="button button--ghost" to={id ? `/chapters/${id}` : `/books/${book.id}`}>Cancel</Link>
      </div>
      {!id && <p className="muted small">You'll add pages, one per place, once the chapter exists.</p>}
    </form>
  )
}

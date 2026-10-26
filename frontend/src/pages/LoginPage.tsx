import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (session) navigate(from, { replace: true })
  }, [session, from, navigate])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // The API shows display_name under your books and comments.
        options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() } },
      })
      if (error) setError(error.message)
      // With email confirmation on (the Supabase default), sign-up returns no session yet.
      else if (!data.session) setNotice('Check your inbox for a confirmation link, then sign in.')
    }
    setBusy(false)
  }

  return (
    <form className="card form form--narrow" onSubmit={submit}>
      <h1>{mode === 'signin' ? 'Welcome back' : 'Start your book'}</h1>
      <p className="muted">Anyone can read Travember. Sign in to write your own travel books.</p>
      {mode === 'signup' && (
        <label>
          Your name
          <input required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <span className="muted small">Shown under your books and comments.</span>
        </label>
      )}
      <label>
        Email
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
      <button type="submit" className="button" disabled={busy}>
        {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
      <p className="muted small">
        {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
        <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </form>
  )
}

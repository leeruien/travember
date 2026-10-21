import { Link, Route, Routes } from 'react-router-dom'
import { RequireAuth, useAuth } from './auth'
import { configError, supabase } from './supabase'
import { ErrorNote } from './components/Status'
import { BookPage } from './pages/BookPage'
import { ChapterPage } from './pages/ChapterPage'
import { ChapterForm } from './pages/ChapterForm'
import { LoginPage } from './pages/LoginPage'

function SiteHeader() {
  const { session } = useAuth()
  return (
    <header className="site-header">
      <Link to="/" className="brand">📍 Travember</Link>
      <nav className="site-nav">
        {session ? (
          <>
            <span className="muted small user-email">{session.user.email}</span>
            <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </nav>
    </header>
  )
}

export function App() {
  return (
    <>
      <SiteHeader />
      {configError && <p className="banner">{configError}</p>}
      <main className="page">
        <Routes>
          <Route path="/" element={<BookPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chapters/new" element={<RequireAuth><ChapterForm /></RequireAuth>} />
          <Route path="/chapters/:id" element={<ChapterPage />} />
          <Route path="/chapters/:id/edit" element={<RequireAuth><ChapterForm /></RequireAuth>} />
          <Route
            path="*"
            element={
              <ErrorNote title="Page not found" message="This page isn't in the book.">
                <Link to="/">← Back to contents</Link>
              </ErrorNote>
            }
          />
        </Routes>
      </main>
    </>
  )
}

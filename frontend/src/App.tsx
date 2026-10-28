import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { RequireAuth, useAuth } from './auth'
import { configError, supabase } from './supabase'
import { ErrorNote } from './components/Status'
import { BookForm } from './pages/BookForm'
import { BookPage } from './pages/BookPage'
import { ChapterPage } from './pages/ChapterPage'
import { ChapterForm } from './pages/ChapterForm'
import { FlightPage } from './pages/FlightPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MyBooksPage } from './pages/MyBooksPage'
import { PageReader } from './pages/PageReader'
import { PlanPage } from './pages/PlanPage'

function SiteHeader() {
  const { session } = useAuth()
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <img src="/icon.svg" alt="" width={36} height={36} />
        Travember
      </Link>
      <nav className="site-nav">
        {session ? (
          <>
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/me">My books</NavLink>
            <NavLink to="/plan">Plan a trip</NavLink>
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
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/me" element={<RequireAuth><MyBooksPage /></RequireAuth>} />
          <Route path="/plan" element={<RequireAuth><PlanPage /></RequireAuth>} />
          <Route path="/books/new" element={<RequireAuth><BookForm /></RequireAuth>} />
          <Route path="/books/:bookId" element={<BookPage />} />
          <Route path="/books/:bookId/edit" element={<RequireAuth><BookForm /></RequireAuth>} />
          <Route path="/books/:bookId/journey" element={<FlightPage />} />
          <Route path="/books/:bookId/chapters/new" element={<RequireAuth><ChapterForm /></RequireAuth>} />
          <Route path="/chapters/:id" element={<ChapterPage />} />
          <Route path="/chapters/:id/edit" element={<RequireAuth><ChapterForm /></RequireAuth>} />
          <Route path="/chapters/:id/pages/:pageId" element={<PageReader />} />
          <Route path="/chapters/:id/journey" element={<FlightPage />} />
          <Route path="/travellers/:userId/journey" element={<FlightPage />} />
          <Route
            path="*"
            element={
              <ErrorNote title="Page not found" message="This page isn't on the shelf.">
                <Link to="/">← Back to the shelf</Link>
              </ErrorNote>
            }
          />
        </Routes>
      </main>
    </>
  )
}

import type { ReactNode } from 'react'

export function Loading() {
  return <p className="status muted">Loading…</p>
}

export function ErrorNote({ title = 'Something went wrong', message, children }: {
  title?: string
  message: string
  children?: ReactNode
}) {
  return (
    <div className="status card" role="alert">
      <h2>{title}</h2>
      <p className="muted">{message}</p>
      {children}
    </div>
  )
}

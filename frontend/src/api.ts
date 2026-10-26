import { supabase } from './supabase'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '')

export interface Media {
  kind: 'image' | 'video'
  url: string
}

/** A page of a chapter: one place, with photos, videos and an optional write-up (`note`). */
export interface Place {
  id: string
  destinationId: string
  name: string
  note: string | null
  latitude: number
  longitude: number
  visitedOn: string | null
  media: Media[]
  likeCount: number
  likedByMe: boolean
  commentCount: number
}

/** A trip — one chapter of a book. */
export interface Destination {
  id: string
  ownerId: string
  bookId: string
  title: string
  country: string | null
  summary: string | null
  coverImageUrl: string | null
  startDate: string | null
  endDate: string | null
  places: Place[]
}

/**
 * A book on the shelf. `coverUrl` is what to show: the author's cover, else the book's first photo, else
 * null for the plain designed cover. `customCoverUrl` is only the cover the author uploaded.
 */
export interface Book {
  id: string
  ownerId: string
  title: string
  description: string | null
  authorName: string
  coverUrl: string | null
  customCoverUrl: string | null
  chapterCount: number
  pageCount: number
}

export interface BookDetail extends Book {
  chapters: Destination[]
}

export interface BookInput {
  title: string
  description: string
  coverUrl: string
}

/** `bookId` is only read when the chapter is created. */
export interface DestinationInput {
  bookId?: string
  title: string
  country: string
  summary: string
  coverImageUrl: string
  startDate: string | null
  endDate: string | null
}

export interface PlaceInput {
  name: string
  note: string
  latitude: number
  longitude: number
  visitedOn: string | null
  media: Media[]
}

export interface Comment {
  id: string
  placeId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

export interface LikeState {
  likeCount: number
  likedByMe: boolean
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Writes need the Supabase access token. Reads are public but send it too when there is one, so the API
 * can say which pages you've liked; if the resource server rejects it (say it's stale), the read is
 * retried as a guest rather than failing.
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (method !== 'GET' && !token) throw new ApiError(401, 'Please sign in first.')

  let res = await send(method, path, body, token)
  if (res.status === 401 && method === 'GET' && token) res = await send(method, path, body)
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  return (res.status === 204 ? undefined : await res.json()) as T
}

async function send(method: string, path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  try {
    return await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, `Can't reach the Travember API at ${API_URL}. Is the backend running?`)
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (body.detail || body.message) return body.detail || body.message
  } catch {
    // Spring Security's 401/403 responses have no body.
  }
  if (res.status === 401) return 'Your session has expired. Please sign in again.'
  if (res.status === 403) return "Only the author can change this."
  if (res.status === 404) return 'Not found.'
  return `Request failed (${res.status}).`
}

export const api = {
  /** Newest first. `q` searches; `ownerId` keeps one author's books; `excludeOwnerId` leaves one author's out. */
  listBooks: (filter: { q?: string; ownerId?: string; excludeOwnerId?: string } = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filter)) if (value?.trim()) params.set(key, value.trim())
    return request<Book[]>('GET', `/api/books${params.size ? `?${params}` : ''}`)
  },
  getBook: (id: string) => request<BookDetail>('GET', `/api/books/${id}`),
  createBook: (input: BookInput) => request<Book>('POST', '/api/books', input),
  updateBook: (id: string, input: BookInput) => request<Book>('PUT', `/api/books/${id}`, input),
  deleteBook: (id: string) => request<void>('DELETE', `/api/books/${id}`),
  listDestinations: (ownerId: string) =>
    request<Destination[]>('GET', `/api/destinations?${new URLSearchParams({ ownerId })}`),
  getDestination: (id: string) => request<Destination>('GET', `/api/destinations/${id}`),
  createDestination: (input: DestinationInput) => request<Destination>('POST', '/api/destinations', input),
  updateDestination: (id: string, input: DestinationInput) =>
    request<Destination>('PUT', `/api/destinations/${id}`, input),
  deleteDestination: (id: string) => request<void>('DELETE', `/api/destinations/${id}`),
  addPlace: (destinationId: string, input: PlaceInput) =>
    request<Place>('POST', `/api/destinations/${destinationId}/places`, input),
  updatePlace: (id: string, input: PlaceInput) => request<Place>('PUT', `/api/places/${id}`, input),
  deletePlace: (id: string) => request<void>('DELETE', `/api/places/${id}`),
  likePlace: (id: string) => request<LikeState>('PUT', `/api/places/${id}/like`),
  unlikePlace: (id: string) => request<LikeState>('DELETE', `/api/places/${id}/like`),
  listComments: (placeId: string) => request<Comment[]>('GET', `/api/places/${placeId}/comments`),
  addComment: (placeId: string, body: string) => request<Comment>('POST', `/api/places/${placeId}/comments`, { body }),
  deleteComment: (id: string) => request<void>('DELETE', `/api/comments/${id}`),
}

import { supabase } from './supabase'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '')

export interface Place {
  id: string
  destinationId: string
  name: string
  note: string | null
  latitude: number
  longitude: number
  visitedOn: string | null
}

/** A trip — one chapter of the book. */
export interface Destination {
  id: string
  ownerId: string
  title: string
  country: string | null
  summary: string | null
  coverImageUrl: string | null
  startDate: string | null
  endDate: string | null
  places: Place[]
}

export interface DestinationInput {
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
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Reads are public, so only writes carry the Supabase access token. Sending a stale token on a GET
 * would make the resource server reject an otherwise public request.
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (method !== 'GET') {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new ApiError(401, 'Please sign in first.')
    headers.Authorization = `Bearer ${data.session.access_token}`
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, `Can't reach the Travember API at ${API_URL}. Is the backend running?`)
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  return (res.status === 204 ? undefined : await res.json()) as T
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (body.detail || body.message) return body.detail || body.message
  } catch {
    // Spring Security's 401/403 responses have no body.
  }
  if (res.status === 401) return 'Your session has expired. Please sign in again.'
  if (res.status === 403) return 'Only the author of this chapter can edit it.'
  if (res.status === 404) return 'Not found.'
  return `Request failed (${res.status}).`
}

export const api = {
  listDestinations: () => request<Destination[]>('GET', '/api/destinations'),
  getDestination: (id: string) => request<Destination>('GET', `/api/destinations/${id}`),
  createDestination: (input: DestinationInput) => request<Destination>('POST', '/api/destinations', input),
  updateDestination: (id: string, input: DestinationInput) =>
    request<Destination>('PUT', `/api/destinations/${id}`, input),
  deleteDestination: (id: string) => request<void>('DELETE', `/api/destinations/${id}`),
  addPlace: (destinationId: string, input: PlaceInput) =>
    request<Place>('POST', `/api/destinations/${destinationId}/places`, input),
  updatePlace: (id: string, input: PlaceInput) => request<Place>('PUT', `/api/places/${id}`, input),
  deletePlace: (id: string) => request<void>('DELETE', `/api/places/${id}`),
}

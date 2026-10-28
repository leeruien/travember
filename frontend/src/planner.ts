import { supabase } from './supabase'

const AGENT_URL = (import.meta.env.VITE_AGENT_URL || 'http://localhost:8000').replace(/\/+$/, '')

/** The planner's answer; the shape is fixed by agent/planner/itinerary.py. */
export interface Itinerary {
  title: string
  country: string
  summary: string
  start_date: string
  end_date: string
  getting_there: string
  days: { date: string; theme: string; weather: string; stops: Stop[] }[]
  tips: string[]
}

export interface Stop {
  name: string
  lat: number
  lng: number
  time: string
  description: string
}

export type PlanEvent =
  | { type: 'tool'; name: string; input: Record<string, unknown> }
  | { type: 'itinerary'; itinerary: Itinerary }
  | { type: 'error'; message: string }
  | { type: 'done' }

/**
 * Asks the planner agent for an itinerary and reports its progress as it researches. The response is a
 * stream of server-sent events; EventSource can't POST or send a token, so this reads the stream itself.
 */
export async function planTrip(request: string, onEvent: (event: PlanEvent) => void, signal: AbortSignal) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Please sign in first.')

  let res: Response
  try {
    res = await fetch(`${AGENT_URL}/plan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ request }),
      signal,
    })
  } catch (e) {
    if (signal.aborted) throw e
    throw new Error(`Can't reach the trip planner at ${AGENT_URL}. Is it running?`)
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null)
    // FastAPI's own validation errors come back as a list; our HTTPExceptions as a sentence.
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Describe your trip in a few more words.')
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += value
    let end
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const lines = buffer.slice(0, end).split('\n')
      buffer = buffer.slice(end + 2)
      const json = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n')
      if (json) onEvent(JSON.parse(json) as PlanEvent)
    }
  }
}

/** A line for the progress list, from a tool the agent called. */
export function describeStep(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'geocode':
      return `📍 Finding ${input.query}`
    case 'weather':
      return `🌦 Checking the weather for ${input.start_date}${input.end_date !== input.start_date ? ` to ${input.end_date}` : ''}`
    case 'places_nearby':
      return `🔎 Looking for ${input.category} nearby`
    case 'travel_time':
      return '🚶 Working out travel times'
    case 'estimate_flight':
      return '✈ Estimating the flight'
    case 'travember_pages':
      return `📖 Reading what other travellers wrote about ${input.query}`
    default:
      return `🔧 ${name}`
  }
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { Media } from '../api'
import { dayBetween, formatDate } from '../format'
import { MediaThumb } from './MediaGallery'
import { pinIcon } from './TripMap'

/** One page on the journey, in the order the plane visits them. */
export interface Stop {
  id: string
  name: string
  lat: number
  lng: number
  date: string | null
  chapterTitle: string
  href: string
  thumb: Media | null
}

type Point = [number, number]

const DWELL_MS = 1800 // how long the plane waits at each stop
const ARC_STEPS = 64
const SPEEDS = [1, 2, 4]

interface Leg {
  points: Point[]
  start: number
  end: number
}

/**
 * The whole flight laid out on a timeline: wait at stop 0, fly leg 0, wait at stop 1, fly leg 1, …
 * Every frame is computed from the time alone, which makes pausing, speeding up and scrubbing trivial.
 */
interface Journey {
  /** Stop positions, with longitudes unwrapped so each leg takes the short way round, even across the date line. */
  points: Point[]
  legs: Leg[]
  /** When the plane lands at each stop. */
  arrivals: number[]
  total: number
}

/** Points along the great circle from a to b, and its length in km. Longitudes continue on from a's. */
function greatCircle([lat1, lng1]: Point, [lat2, lng2]: Point): { points: Point[]; km: number } {
  const r = Math.PI / 180
  const [φ1, λ1, φ2, λ2] = [lat1 * r, lng1 * r, lat2 * r, lng2 * r]
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
  ))
  const km = d * 6371
  // The same place, or exactly opposite sides of the earth (where every great circle is as good as another).
  if (Math.sin(d) < 1e-6) return { points: [[lat1, lng1], [lat2, lng2]], km }

  const points: Point[] = []
  let prevLng = lng1
  for (let i = 0; i <= ARC_STEPS; i++) {
    const f = i / ARC_STEPS
    const a = Math.sin((1 - f) * d) / Math.sin(d)
    const b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2)
    const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2)
    const z = a * Math.sin(φ1) + b * Math.sin(φ2)
    let lng = Math.atan2(y, x) / r
    lng += 360 * Math.round((prevLng - lng) / 360)
    points.push([Math.atan2(z, Math.hypot(x, y)) / r, lng])
    prevLng = lng
  }
  return { points, km }
}

function buildJourney(stops: Stop[]): Journey {
  const points: Point[] = []
  const legs: Leg[] = []
  const arrivals: number[] = []
  let t = 0
  stops.forEach((s, i) => {
    if (i === 0) {
      points.push([s.lat, s.lng])
      arrivals.push(0)
      return
    }
    const from = points[i - 1]
    const to: Point = [s.lat, s.lng + 360 * Math.round((from[1] - s.lng) / 360)]
    const { points: arc, km } = greatCircle(from, to)
    const duration = Math.min(4500, 900 + km * 0.25) // long-haul legs take longer, up to a point
    legs.push({ points: arc, start: t + DWELL_MS, end: t + DWELL_MS + duration })
    t += DWELL_MS + duration
    points.push(to)
    arrivals.push(t)
  })
  return { points, legs, arrivals, total: t + DWELL_MS }
}

/** Where along a polyline a fraction f (0–1) of the way is. */
function along(points: Point[], f: number): Point {
  const x = f * (points.length - 1)
  const i = Math.min(Math.floor(x), points.length - 2)
  const k = x - i
  const [a, b] = [points[i], points[i + 1]]
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
}

const ease = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2

interface Frame {
  pos: Point
  /** A little further along the leg, to point the plane the way it's going. Null while waiting at a stop. */
  ahead: Point | null
  /** The stop the plane is at, or most recently left. */
  stop: number
  /** The leg being flown, if any. */
  leg: number | null
  /** How far through that leg, eased. */
  f: number
  trail: Point[]
}

function frameAt(j: Journey, t: number): Frame {
  const leg = j.legs.findIndex((l) => t >= l.start && t < l.end)
  if (leg < 0) {
    let stop = 0
    while (stop + 1 < j.arrivals.length && j.arrivals[stop + 1] <= t) stop++
    return { pos: j.points[stop], ahead: null, stop, leg: null, f: 0, trail: j.legs.slice(0, stop).flatMap((l) => l.points) }
  }
  const l = j.legs[leg]
  const f = ease((t - l.start) / (l.end - l.start))
  const pos = along(l.points, f)
  const flown = l.points.slice(0, Math.floor(f * (l.points.length - 1)) + 1)
  return {
    pos,
    ahead: along(l.points, Math.min(1, f + 0.02)),
    stop: leg,
    leg,
    f,
    trail: [...j.legs.slice(0, leg).flatMap((x) => x.points), ...flown, pos],
  }
}

/** What the caption shows. Kept small so React only re-renders when the text actually changes. */
interface Caption {
  stop: number
  leg: number | null
  date: string | null
}

function captionFor(stops: Stop[], fr: Frame): Caption {
  if (fr.leg === null) {
    const date = stops[fr.stop].date
    return { stop: fr.stop, leg: null, date: date && formatDate(date) }
  }
  // While flying, the date rolls forward from one stop's date to the next.
  const [a, b] = [stops[fr.leg].date, stops[fr.leg + 1].date]
  return { stop: fr.stop, leg: fr.leg, date: a && b ? formatDate(dayBetween(a, b, fr.f)) : b && formatDate(b) }
}

const planeIcon = L.divIcon({
  className: '',
  // Material Design "flight" icon (Apache 2.0), pointing north.
  html: '<span class="plane"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg></span>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Every stop on one map, and a plane that flies between them in order, with the date rolling along.
 * The plane, its trail and the camera are driven imperatively each animation frame; React only
 * renders the controls, the pins and the caption.
 */
export function FlightMap({ stops }: { stops: Stop[] }) {
  const journey = useMemo(() => buildJourney(stops), [stops])
  const [map, setMap] = useState<L.Map | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [caption, setCaption] = useState<Caption>(() => captionFor(stops, frameAt(journey, 0)))

  const time = useRef(0)
  const slider = useRef<HTMLInputElement>(null)
  const layers = useRef<{ plane: L.Marker; trail: L.Polyline } | null>(null)
  const heading = useRef(0)
  const framedLeg = useRef<number | null>(null)

  const draw = useCallback((t: number, jump = false) => {
    const fr = frameAt(journey, t)
    const l = layers.current
    if (map && l) {
      l.plane.setLatLng(fr.pos)
      l.trail.setLatLngs(fr.trail)
      if (fr.ahead) {
        // Measure the heading on screen, so the nose follows the curve as drawn on this projection.
        const a = map.latLngToLayerPoint(fr.pos)
        const b = map.latLngToLayerPoint(fr.ahead)
        if (a.distanceTo(b) > 0.5) heading.current = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90
      }
      const el = l.plane.getElement()?.firstElementChild as HTMLElement | null
      if (el) el.style.transform = `rotate(${heading.current}deg)`

      // Frame each leg as the plane sets off on it.
      if (fr.leg !== null && fr.leg !== framedLeg.current) {
        framedLeg.current = fr.leg
        const bounds = L.latLngBounds(journey.legs[fr.leg].points)
        const opts = { padding: [70, 70] as L.PointTuple, maxZoom: 6 }
        if (jump || reducedMotion()) map.fitBounds(bounds, { ...opts, animate: false })
        else map.flyToBounds(bounds, { ...opts, duration: 1.2 })
      } else if (fr.leg === null && jump) {
        map.setView(fr.pos, Math.max(map.getZoom(), 4), { animate: false })
      }
    }
    if (slider.current) slider.current.value = String(t)
    const next = captionFor(stops, fr)
    setCaption((c) => (c.stop === next.stop && c.leg === next.leg && c.date === next.date ? c : next))
  }, [map, journey, stops])

  const showAll = useCallback(() => {
    if (!map) return
    if (journey.points.length === 1) map.setView(journey.points[0], 6)
    else map.fitBounds(journey.points, { padding: [50, 50], maxZoom: 6 })
  }, [map, journey])

  // The plane and its trail are plain Leaflet layers, updated every frame without going through React.
  useEffect(() => {
    if (!map) return
    const trail = L.polyline([], { className: 'flight-trail', interactive: false }).addTo(map)
    const plane = L.marker(journey.points[0], { icon: planeIcon, interactive: false, keyboard: false, zIndexOffset: 3000 })
      .addTo(map)
    layers.current = { plane, trail }
    time.current = 0
    framedLeg.current = null
    draw(0)
    showAll()
    return () => {
      trail.remove()
      plane.remove()
      layers.current = null
    }
  }, [map, journey, draw, showAll])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      time.current = Math.min(journey.total, time.current + (now - last) * speed)
      last = now
      draw(time.current)
      if (time.current >= journey.total) setPlaying(false)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, journey, draw])

  function play() {
    if (time.current >= journey.total || time.current === 0) {
      time.current = 0
      framedLeg.current = null
      draw(0)
      map?.flyTo(journey.points[0], 5, { animate: !reducedMotion(), duration: 1.2 })
    }
    setPlaying(true)
  }

  function seek(t: number) {
    time.current = t
    framedLeg.current = null
    draw(t, true)
  }

  const canFly = stops.length > 1
  const done = !playing && time.current >= journey.total
  const stop = stops[caption.stop]
  const nextStop = caption.leg !== null ? stops[caption.leg + 1] : null
  const pinned = caption.leg === null ? caption.stop : -1
  const route = useMemo(() => journey.legs.flatMap((l) => l.points), [journey])

  return (
    <div className="flight">
      <div className="flight-stage">
        <MapContainer ref={setMap} center={[20, 0]} zoom={2} minZoom={2} scrollWheelZoom={false} className="map map--flight">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {route.length > 1 && <Polyline positions={route} pathOptions={{ className: 'route-line route-line--faint' }} />}
          {stops.map((s, i) => (
            <Marker
              key={s.id}
              position={journey.points[i]}
              icon={pinIcon(String(i + 1), i === pinned ? 'selected' : 'default')}
              zIndexOffset={i === pinned ? 1000 : 0}
            >
              <Popup>
                <strong>{s.name}</strong>
                <div className="muted">{s.date ? formatDate(s.date) : 'Undated'} · {s.chapterTitle}</div>
                <Link to={s.href}>Read the page →</Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="flight-card">
          <p className="flight-date">{caption.date ?? 'Undated'}</p>
          <div aria-live="polite">
            {nextStop ? (
              <p className="flight-status">✈ Flying to <strong>{nextStop.name}</strong></p>
            ) : (
              <>
                {stop.thumb && <MediaThumb media={stop.thumb} className="flight-thumb" />}
                <p className="flight-stop">{stop.name}</p>
                <p className="muted small">{stop.chapterTitle}</p>
                <Link className="small" to={stop.href}>Read the page →</Link>
              </>
            )}
          </div>
          <p className="muted small flight-count">Stop {caption.stop + 1} of {stops.length}</p>
        </div>
      </div>

      <div className="flight-controls">
        {playing ? (
          <button className="button" onClick={() => setPlaying(false)}>❚❚ Pause</button>
        ) : (
          <button className="button" onClick={play} disabled={!canFly}>
            {done ? '↺ Fly again' : time.current > 0 ? '▶ Resume' : '✈ Take off'}
          </button>
        )}
        <input
          ref={slider}
          type="range"
          className="flight-progress"
          min={0}
          max={journey.total}
          step={1}
          defaultValue={0}
          disabled={!canFly}
          aria-label="Journey progress"
          onInput={(e) => seek(Number(e.currentTarget.value))}
        />
        <div className="segmented" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} className={s === speed ? 'is-active' : undefined} aria-pressed={s === speed} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <button className="link" onClick={showAll}>Show all</button>
      </div>
      {!canFly && <p className="hint">Add pages in at least two places to take flight.</p>}
    </div>
  )
}

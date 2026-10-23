import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Link } from 'react-router-dom'

export interface LatLng {
  lat: number
  lng: number
}

export interface Pin extends LatLng {
  id: string
  label: string
  title: string
  subtitle?: string
  href?: string
}

type PinVariant = 'default' | 'selected' | 'draft'

const iconCache = new Map<string, L.DivIcon>()

/** A CSS teardrop with the label inside; avoids Leaflet's default PNG icons, which bundlers break. */
export function pinIcon(label: string, variant: PinVariant) {
  const key = `${variant}:${label}`
  let icon = iconCache.get(key)
  if (!icon) {
    const text = label.replace(/[&<>"]/g, '')
    icon = L.divIcon({
      className: '',
      html: `<span class="pin pin--${variant}"><span>${text}</span></span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 34],
      popupAnchor: [0, -30],
    })
    iconCache.set(key, icon)
  }
  return icon
}

/** Refits the view whenever the set of pins changes, not on every render. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 11)
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 12 })
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function FlyTo({ focus }: { focus: LatLng | null | undefined }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 12), { duration: 0.8 })
  }, [map, focus])
  return null
}

function ClickHandler({ onClick }: { onClick: (point: LatLng) => void }) {
  useMapEvents({
    // wrap() keeps longitude within ±180 even after panning across the date line.
    click: (e) => {
      const { lat, lng } = e.latlng.wrap()
      onClick({ lat, lng })
    },
  })
  return null
}

interface TripMapProps {
  pins: Pin[]
  /** Connect pins in order with a dashed line, like an itinerary. */
  route?: boolean
  selectedId?: string | null
  draft?: LatLng | null
  focus?: LatLng | null
  onSelect?: (id: string) => void
  onMapClick?: (point: LatLng) => void
  className?: string
}

export function TripMap({ pins, route, selectedId, draft, focus, onSelect, onMapClick, className }: TripMapProps) {
  const points = pins.map((p) => [p.lat, p.lng] as [number, number])

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      scrollWheelZoom={false}
      worldCopyJump
      className={`map ${onMapClick ? 'map--picking' : ''} ${className ?? ''}`}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FitBounds points={points} />
      <FlyTo focus={focus} />
      {onMapClick && <ClickHandler onClick={onMapClick} />}

      {route && points.length > 1 && <Polyline positions={points} pathOptions={{ className: 'route-line' }} />}

      {pins.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pinIcon(p.label, p.id === selectedId ? 'selected' : 'default')}
          zIndexOffset={p.id === selectedId ? 1000 : 0}
          eventHandlers={onSelect ? { click: () => onSelect(p.id) } : undefined}
        >
          <Popup>
            <strong>{p.title}</strong>
            {p.subtitle && <div className="muted">{p.subtitle}</div>}
            {p.href && <Link to={p.href}>Open chapter →</Link>}
          </Popup>
        </Marker>
      ))}

      {draft && <Marker position={[draft.lat, draft.lng]} icon={pinIcon('+', 'draft')} zIndexOffset={2000} />}
    </MapContainer>
  )
}

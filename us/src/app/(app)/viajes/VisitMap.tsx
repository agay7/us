'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Zone } from '@/lib/viajes/zones'
import { CATEGORY_COLOR, type MarkerCategory } from '@/lib/viajes/markerCategory'

// SVG pins drawn inline instead of Leaflet's default image-based marker:
// sidesteps the Leaflet+Next.js bundler asset issues entirely (already
// hit twice with the image-import approach) and lets each marker take an
// arbitrary color with no extra image assets.
function coloredIcon(category: MarkerCategory) {
  const color = CATEGORY_COLOR[category]
  return L.divIcon({
    className: '', // avoid Leaflet's default divIcon white box styles
    html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z"
            fill="${color}" stroke="#00000055" stroke-width="1"/>
      <circle cx="12.5" cy="12.5" r="5" fill="white" fill-opacity="0.95"/>
    </svg>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  })
}

const ICONS: Record<MarkerCategory, L.DivIcon> = {
  together: coloredIcon('together'),
  me: coloredIcon('me'),
  partner: coloredIcon('partner'),
}

export type MapPlace = {
  id: string
  name: string
  lat: number
  lng: number
  category: MarkerCategory
}

// Static fallback view for a zone when the current filter has zero
// geolocated markers in it (e.g. no visits to Spain yet) — so picking
// "España" still shows Spanish territory instead of leaving the map on
// whatever view it happened to have before. 'world'/'all' fall back to
// the default world view further down instead of a fixed box.
const ZONE_FALLBACK_BOUNDS: Partial<Record<Zone | 'all', [[number, number], [number, number]]>> = {
  spain: [
    [27.5, -18.5],
    [43.9, 4.5],
  ],
  europe: [
    [34, -25],
    [72, 45],
  ],
}

// Imperatively re-fits the map's view whenever the marker set or zone
// changes: react-leaflet's <MapContainer center/zoom> props only apply on
// first mount, so switching zones/filters needs an explicit fitBounds
// call via the map instance (obtained through useMap()) to actually move
// the view instead of just re-rendering markers in place.
function FitBounds({ places, zone }: { places: MapPlace[]; zone: Zone | 'all' }) {
  const map = useMap()

  useEffect(() => {
    if (places.length > 0) {
      const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 })
      return
    }

    const fallback = ZONE_FALLBACK_BOUNDS[zone]
    if (fallback) {
      map.fitBounds(fallback, { padding: [30, 30] })
    } else {
      map.setView([20, 0], 2)
    }
  }, [places, zone, map])

  return null
}

export default function VisitMap({
  places,
  zone,
  partnerLabel,
}: {
  places: MapPlace[]
  zone: Zone | 'all'
  partnerLabel: string
}) {
  return (
    <div>
      <div className="h-[58vh] w-full overflow-hidden rounded-xl">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds places={places} zone={zone} />
          {places.map((place) => (
            <Marker key={place.id} position={[place.lat, place.lng]} icon={ICONS[place.category]}>
              <Popup>{place.name}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="flex gap-3 pt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CATEGORY_COLOR.me }}
          />
          Tú
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CATEGORY_COLOR.partner }}
          />
          {partnerLabel}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CATEGORY_COLOR.together }}
          />
          En común
        </span>
      </div>
    </div>
  )
}

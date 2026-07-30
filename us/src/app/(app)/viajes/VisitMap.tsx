'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

export type MarkerCategory = 'together' | 'me' | 'partner'

const CATEGORY_COLOR: Record<MarkerCategory, string> = {
  together: '#8b5cf6', // violeta
  me: '#f97316', // naranja
  partner: '#14b8a6', // verde azulado
}

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

export default function VisitMap({ places }: { places: MapPlace[] }) {
  const center: [number, number] = places[0] ? [places[0].lat, places[0].lng] : [20, 0]
  const zoom = places.length > 0 ? 4 : 2

  return (
    <div>
      <div className="h-64 w-full overflow-hidden rounded-xl">
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
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
            style={{ backgroundColor: CATEGORY_COLOR.together }}
          />
          Juntos
        </span>
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
          Tu pareja
        </span>
      </div>
    </div>
  )
}

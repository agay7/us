'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Leaflet's default marker icon references relative image paths that
// don't resolve through Next.js's bundler (a well-known Leaflet+webpack/
// Turbopack interop issue) — importing the images that already ship
// inside the installed `leaflet` package fixes it with no external
// dependency (no CDN, no image-hosting budget needed).
//
// The `next-env.d.ts` image-import type says these imports are
// `StaticImageData` ({ src, width, height, ... }), but this Next.js
// version's Turbopack build resolves them to plain strings at runtime
// (confirmed live — `.src` is undefined, the import itself is the URL).
// Cast to match the actual runtime value rather than the stale type.
const defaultIcon = L.icon({
  iconUrl: markerIcon as unknown as string,
  iconRetinaUrl: markerIcon2x as unknown as string,
  shadowUrl: markerShadow as unknown as string,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export type MapPlace = {
  id: string
  name: string
  lat: number
  lng: number
}

export default function VisitMap({ places }: { places: MapPlace[] }) {
  const center: [number, number] = places[0] ? [places[0].lat, places[0].lng] : [20, 0]
  const zoom = places.length > 0 ? 4 : 2

  return (
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
          <Marker key={place.id} position={[place.lat, place.lng]} icon={defaultIcon}>
            <Popup>{place.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

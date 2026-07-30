'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Loaded from a CDN rather than imported from node_modules: Leaflet's
// default marker images don't resolve cleanly through Next.js's bundler
// (a well-known Leaflet+webpack/Turbopack interop issue), and this app
// has no image-hosting budget of its own to work around it differently.
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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

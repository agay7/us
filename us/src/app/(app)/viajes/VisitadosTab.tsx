// src/app/(app)/viajes/VisitadosTab.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { formatVisitSummary, type Participant } from '@/lib/viajes/formatVisit'
import { getMarkerCategory } from '@/lib/viajes/markerCategory'
import type { Zone } from '@/lib/viajes/zones'
import type { MapPlace } from './VisitMap'
import AddVisitForm from './AddVisitForm'

// Leaflet touches `window` at module load — it can't be part of the
// server-rendered HTML for this (already client-only) tab.
const VisitMap = dynamic(() => import('./VisitMap'), { ssr: false })

type VisitRow = {
  id: string
  visited_at: string | null
  places: { id: string; name: string; scope: Zone; lat: number | null; lng: number | null } | null
  place_visit_participants: { user_id: string; profiles: { display_name: string } | null }[]
  visit_photos: { id: string }[]
}

export default function VisitadosTab({ spaceId, zone }: { spaceId: string; zone: Zone | 'all' }) {
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('place_visits')
      .select(
        'id, visited_at, places(id, name, scope, lat, lng), place_visit_participants(user_id, profiles(display_name)), visit_photos(id)'
      )
      .eq('space_id', spaceId)
      .order('visited_at', { ascending: false, nullsFirst: false })

    if (requestId !== requestIdRef.current) return // a newer request already landed; discard this stale response

    setVisits((data as unknown as VisitRow[]) ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const filtered = visits.filter((v) => zone === 'all' || v.places?.scope === zone)

  const geolocated = filtered.filter((v) => v.places?.lat != null && v.places?.lng != null)

  const visitsByPlace = new Map<string, VisitRow[]>()
  for (const visit of geolocated) {
    const placeId = visit.places!.id
    const existing = visitsByPlace.get(placeId) ?? []
    existing.push(visit)
    visitsByPlace.set(placeId, existing)
  }

  const mapPlaces: MapPlace[] = currentUserId
    ? Array.from(visitsByPlace.values()).map((placeVisits) => {
        const place = placeVisits[0].places!
        const participantsPerVisit = placeVisits.map((v) =>
          v.place_visit_participants.map((p) => p.user_id)
        )
        return {
          id: place.id,
          name: place.name,
          lat: place.lat!,
          lng: place.lng!,
          category: getMarkerCategory(participantsPerVisit, currentUserId),
        }
      })
    : []

  if (loading || currentUserId === null) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  return (
    <div className="p-3">
      <div className="mb-3">
        <VisitMap places={mapPlaces} />
      </div>

      {filtered.map((visit) => {
        const participants: Participant[] = visit.place_visit_participants.map((p) => ({
          userId: p.user_id,
          displayName: p.profiles?.display_name ?? 'Alguien',
        }))
        return (
          <div key={visit.id} className="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 p-2 text-gray-900">
            <div className="flex-1">
              <p className="font-bold">{visit.places?.name}</p>
              <p className="text-xs opacity-80">
                {formatVisitSummary(participants, visit.visited_at)} · {visit.visit_photos.length} fotos
              </p>
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">Todavía no hay sitios visitados aquí.</p>
      )}

      {showForm ? (
        <AddVisitForm
          spaceId={spaceId}
          onDone={() => {
            setShowForm(false)
            load()
          }}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-2 w-full rounded border border-blue-600 py-2 text-center text-blue-600"
        >
          + Añadir sitio visitado
        </button>
      )}
    </div>
  )
}

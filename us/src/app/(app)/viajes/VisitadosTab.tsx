// src/app/(app)/viajes/VisitadosTab.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { formatVisitSummary, type Participant } from '@/lib/viajes/formatVisit'
import { getMarkerCategory, type MarkerCategory } from '@/lib/viajes/markerCategory'
import type { Zone } from '@/lib/viajes/zones'
import type { MapPlace } from './VisitMap'
import AddVisitForm from './AddVisitForm'
import EditVisitForm from './EditVisitForm'

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

type PersonFilter = 'all' | MarkerCategory

export default function VisitadosTab({ spaceId, zone }: { spaceId: string; zone: Zone | 'all' }) {
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [personFilter, setPersonFilter] = useState<PersonFilter>('all')
  const [showList, setShowList] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null)
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
    async function loadIdentity() {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      setCurrentUserId(uid)
      if (!uid) return

      // space_members.user_id references auth.users directly (not
      // profiles.user_id), so PostgREST has no FK to auto-embed profiles
      // here — unlike place_visit_participants/place_wishlist, which were
      // pointed at profiles specifically to allow that embed. Two-step
      // lookup instead of a nested select.
      const { data: members } = await supabase
        .from('space_members')
        .select('user_id')
        .eq('space_id', spaceId)

      const partnerId = members?.find((m) => m.user_id !== uid)?.user_id
      if (!partnerId) {
        setPartnerName(null)
        return
      }

      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', partnerId)
        .maybeSingle()

      setPartnerName(partnerProfile?.display_name ?? null)
    }
    loadIdentity()
  }, [spaceId])

  async function handleDeleteVisit(visitId: string) {
    if (!window.confirm('¿Seguro que quieres eliminar esta visita? No se puede deshacer.')) return

    const supabase = createClient()
    const { data: photos } = await supabase.from('visit_photos').select('url').eq('visit_id', visitId)
    const paths = (photos ?? []).map((p) => p.url)
    if (paths.length > 0) {
      await supabase.storage.from('visit-photos').remove(paths)
    }

    const { error } = await supabase.rpc('delete_visit', { p_visit_id: visitId })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  // A place counts as "en común" if the two of you have EVER been there
  // between you — including two separate solo visits, not just a single
  // visit event with both participants attached (bulk-imported history is
  // almost entirely separate solo visits per place, so requiring a shared
  // visit event would make "En común" match almost nothing). So the person
  // filter groups by place first and categorizes each place from ALL of
  // its visits, then filters visits by their place's category — the same
  // aggregation VisitMap's pins already use, kept in sync here so the list
  // and the map never disagree about which places are "en común".
  //
  // Both derived arrays are memoized together so their identity stays
  // stable across unrelated re-renders (toggling the list, entering edit
  // mode) — VisitMap's fitBounds effect is keyed on mapPlaces, and a new
  // array on every render would reset the user's pan/zoom on every
  // keystroke elsewhere.
  const { personFiltered, mapPlaces } = useMemo(() => {
    if (currentUserId === null) return { personFiltered: [] as VisitRow[], mapPlaces: [] as MapPlace[] }

    const zoneFiltered = visits.filter((v) => zone === 'all' || v.places?.scope === zone)

    const visitsByPlaceId = new Map<string, VisitRow[]>()
    for (const visit of zoneFiltered) {
      if (!visit.places) continue
      const existing = visitsByPlaceId.get(visit.places.id) ?? []
      existing.push(visit)
      visitsByPlaceId.set(visit.places.id, existing)
    }

    const placeCategory = new Map<string, MarkerCategory>()
    for (const [placeId, placeVisits] of visitsByPlaceId) {
      const participantsPerVisit = placeVisits.map((v) =>
        v.place_visit_participants.map((p) => p.user_id)
      )
      placeCategory.set(placeId, getMarkerCategory(participantsPerVisit, currentUserId))
    }

    const personFiltered = zoneFiltered.filter((v) => {
      if (personFilter === 'all') return true
      return v.places != null && placeCategory.get(v.places.id) === personFilter
    })

    const geolocated = personFiltered.filter((v) => v.places?.lat != null && v.places?.lng != null)
    const visitsByPlace = new Map<string, VisitRow[]>()
    for (const visit of geolocated) {
      const placeId = visit.places!.id
      const existing = visitsByPlace.get(placeId) ?? []
      existing.push(visit)
      visitsByPlace.set(placeId, existing)
    }

    const mapPlaces: MapPlace[] = Array.from(visitsByPlace.values()).map((placeVisits) => {
      const place = placeVisits[0].places!
      return {
        id: place.id,
        name: place.name,
        lat: place.lat!,
        lng: place.lng!,
        category: placeCategory.get(place.id)!,
      }
    })

    return { personFiltered, mapPlaces }
  }, [visits, zone, personFilter, currentUserId])

  if (loading || currentUserId === null) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setPersonFilter('all')}
          className={`rounded-full border px-3 py-1 ${personFilter === 'all' ? '' : 'opacity-50'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setPersonFilter('me')}
          className={`rounded-full border px-3 py-1 ${personFilter === 'me' ? '' : 'opacity-50'}`}
        >
          Tú
        </button>
        <button
          onClick={() => setPersonFilter('together')}
          className={`rounded-full border px-3 py-1 ${personFilter === 'together' ? '' : 'opacity-50'}`}
        >
          En común
        </button>
        {partnerName && (
          <button
            onClick={() => setPersonFilter('partner')}
            className={`rounded-full border px-3 py-1 ${personFilter === 'partner' ? '' : 'opacity-50'}`}
          >
            {partnerName}
          </button>
        )}
      </div>

      <VisitMap places={mapPlaces} zone={zone} partnerLabel={partnerName ?? 'Tu pareja'} />

      <button
        onClick={() => setShowList((s) => !s)}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900"
      >
        <span>Lista de sitios ({personFiltered.length})</span>
        <span>{showList ? '▲' : '▼'}</span>
      </button>

      {showList && (
        <div className="mt-2">
          {personFiltered.map((visit) => {
            const participants: Participant[] = visit.place_visit_participants.map((p) => ({
              userId: p.user_id,
              displayName: p.profiles?.display_name ?? 'Alguien',
            }))
            const isEditing = editingVisitId === visit.id
            return (
              <div key={visit.id} className="mb-2 rounded-xl bg-gray-100 p-2 text-gray-900">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="font-bold">{visit.places?.name}</p>
                    <p className="text-xs opacity-80">
                      {formatVisitSummary(participants, visit.visited_at)} · {visit.visit_photos.length}{' '}
                      fotos
                    </p>
                  </div>
                  {!isEditing && (
                    <div className="flex shrink-0 gap-2 text-xs">
                      <button onClick={() => setEditingVisitId(visit.id)} className="text-blue-600">
                        Editar
                      </button>
                      <button onClick={() => handleDeleteVisit(visit.id)} className="text-red-600">
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <EditVisitForm
                    spaceId={spaceId}
                    visitId={visit.id}
                    initialMonth={visit.visited_at ? visit.visited_at.slice(0, 7) : ''}
                    onDone={() => {
                      setEditingVisitId(null)
                      load()
                    }}
                    onCancel={() => setEditingVisitId(null)}
                  />
                )}
              </div>
            )
          })}

          {personFiltered.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">Todavía no hay sitios visitados aquí.</p>
          )}
        </div>
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

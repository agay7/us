// src/app/(app)/viajes/VisitadosTab.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { formatVisitSummary, type Participant } from '@/lib/viajes/formatVisit'
import { getMarkerCategory, type MarkerCategory } from '@/lib/viajes/markerCategory'
import { usePartnerInfo } from '@/lib/usePartnerName'
import type { Zone } from '@/lib/viajes/zones'
import type { MapPlace } from './VisitMap'
import AddVisitForm from './AddVisitForm'
import EditVisitForm from './EditVisitForm'
import VisitPhotos from './VisitPhotos'

// Leaflet touches `window` at module load — it can't be part of the
// server-rendered HTML for this (already client-only) tab.
const VisitMap = dynamic(() => import('./VisitMap'), { ssr: false })

type VisitRow = {
  id: string
  visited_at: string | null
  created_by: string
  places: { id: string; name: string; scope: Zone; lat: number | null; lng: number | null } | null
  place_visit_participants: { user_id: string; profiles: { display_name: string } | null }[]
  visit_photos: { id: string; url: string }[]
}

type PersonFilter = 'all' | MarkerCategory

export default function VisitadosTab({ spaceId, zone }: { spaceId: string; zone: Zone | 'all' }) {
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { partnerName } = usePartnerInfo(spaceId, currentUserId)
  const [personFilter, setPersonFilter] = useState<PersonFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showList, setShowList] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null)
  const [highlightedPlaceId, setHighlightedPlaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const requestIdRef = useRef(0)
  const placeCardRefs = useRef(new Map<string, HTMLDivElement>())

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('place_visits')
      .select(
        'id, visited_at, created_by, places(id, name, scope, lat, lng), place_visit_participants(user_id, profiles(display_name)), visit_photos(id, url)'
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

  // Tapping a pin opens the list (if it was collapsed) and scrolls to
  // that place's card instead of a cramped Leaflet popup — the card
  // already has everything (dates, who, photos, edit/delete), no need to
  // duplicate any of it in a bubble on the map itself.
  function handleSelectPlace(placeId: string) {
    setShowList(true)
    setHighlightedPlaceId(placeId)
  }

  useEffect(() => {
    if (!highlightedPlaceId || !showList) return

    const card = placeCardRefs.current.get(highlightedPlaceId)
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const timeout = setTimeout(() => setHighlightedPlaceId(null), 2500)
    return () => clearTimeout(timeout)
  }, [highlightedPlaceId, showList])

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
  // All derived values are memoized together so their identity stays
  // stable across unrelated re-renders (toggling the list, entering edit
  // mode) — VisitMap's fitBounds effect is keyed on mapPlaces, and a new
  // array on every render would reset the user's pan/zoom on every
  // keystroke elsewhere.
  // Space-wide (not zone/person-filtered): adding "Gredos" should be
  // blocked regardless of which zone or person filter happens to be
  // active right now, since the duplicate would still exist once you
  // switch back.
  const existingPlaceNames = useMemo(
    () => new Set(visits.filter((v) => v.places).map((v) => v.places!.name.trim().toLowerCase())),
    [visits]
  )

  const { personFiltered, mapPlaces, placeCategory } = useMemo(() => {
    if (currentUserId === null) {
      return {
        personFiltered: [] as VisitRow[],
        mapPlaces: [] as MapPlace[],
        placeCategory: new Map<string, MarkerCategory>(),
      }
    }

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

    const query = searchQuery.trim().toLowerCase()
    const personFiltered = zoneFiltered.filter((v) => {
      if (personFilter !== 'all' && (v.places == null || placeCategory.get(v.places.id) !== personFilter)) {
        return false
      }
      if (query && !v.places?.name.toLowerCase().includes(query)) {
        return false
      }
      return true
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

    return { personFiltered, mapPlaces, placeCategory }
  }, [visits, zone, personFilter, currentUserId, searchQuery])

  // With no single-category filter picked, split the list into "En
  // común" / "Tú" / partner sections instead of one long flat list — the
  // three groups read the same way the filter chips and legend already
  // do. A specific filter chip already narrows to one category, so it
  // stays a single flat list (a lone section header would be redundant).
  const sections: { key: MarkerCategory; label: string; visits: VisitRow[] }[] = useMemo(() => {
    if (personFilter !== 'all') {
      return [{ key: personFilter, label: '', visits: personFiltered }]
    }

    const buckets: Record<MarkerCategory, VisitRow[]> = { together: [], me: [], partner: [] }
    for (const visit of personFiltered) {
      if (!visit.places) continue
      const category = placeCategory.get(visit.places.id)
      if (category) buckets[category].push(visit)
    }

    return [
      { key: 'together' as const, label: 'En común', visits: buckets.together },
      { key: 'me' as const, label: 'Tú', visits: buckets.me },
      { key: 'partner' as const, label: partnerName ?? 'Tu pareja', visits: buckets.partner },
    ].filter((section) => section.visits.length > 0)
  }, [personFiltered, placeCategory, personFilter, partnerName])

  if (loading || currentUserId === null) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  function renderVisitEntry(visit: VisitRow) {
    const participants: Participant[] = visit.place_visit_participants.map((p) => ({
      userId: p.user_id,
      displayName: p.profiles?.display_name ?? 'Alguien',
    }))
    const isEditing = editingVisitId === visit.id
    const soloCategory: MarkerCategory = visit.created_by === currentUserId ? 'me' : 'partner'

    const photoPaths = visit.visit_photos.map((p) => p.url)

    return (
      <div key={visit.id}>
        <div className="flex items-center gap-2 py-0.5">
          <p className="flex-1 text-xs opacity-80">
            {formatVisitSummary(participants, visit.visited_at)} · {visit.visit_photos.length} fotos
          </p>
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

        <VisitPhotos paths={photoPaths} />

        {isEditing && (
          <EditVisitForm
            spaceId={spaceId}
            visitId={visit.id}
            initialMonth={visit.visited_at ? visit.visited_at.slice(0, 7) : ''}
            initialTogether={visit.place_visit_participants.length >= 2}
            hasPartner={partnerName !== null}
            soloCategory={soloCategory}
            onDone={() => {
              setEditingVisitId(null)
              load()
            }}
            onCancel={() => setEditingVisitId(null)}
          />
        )}
      </div>
    )
  }

  // Bulk-imported history logs each person's trip to a place as its own
  // separate visit row, so the same place could show up as two cards
  // ("Gredos" visited solo by one of you, "Gredos" visited by both) —
  // confusing, since to a reader it's the same place twice. Group by
  // place so it's one card either way, with each underlying visit listed
  // as its own line (so "juntos" and "por separado" both still show, and
  // each keeps its own edit/delete).
  function groupByPlace(groupVisits: VisitRow[]): VisitRow[][] {
    const byPlaceId = new Map<string, VisitRow[]>()
    for (const visit of groupVisits) {
      if (!visit.places) continue
      const existing = byPlaceId.get(visit.places.id) ?? []
      existing.push(visit)
      byPlaceId.set(visit.places.id, existing)
    }
    return Array.from(byPlaceId.values())
  }

  function countPlaces(countVisits: VisitRow[]): number {
    return new Set(countVisits.filter((v) => v.places).map((v) => v.places!.id)).size
  }

  function renderPlaceCard(placeVisits: VisitRow[]) {
    const place = placeVisits[0].places!
    const isHighlighted = highlightedPlaceId === place.id
    return (
      <div
        key={place.id}
        ref={(el) => {
          if (el) placeCardRefs.current.set(place.id, el)
          else placeCardRefs.current.delete(place.id)
        }}
        className={`mb-2 rounded-xl bg-gray-100 p-2 text-gray-900 transition-shadow ${
          isHighlighted ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <p className="font-bold">{place.name}</p>
        {placeVisits.map(renderVisitEntry)}
      </div>
    )
  }

  return (
    <div className="p-3">
      <label htmlFor="visited-search" className="sr-only">
        Buscar un sitio
      </label>
      <input
        id="visited-search"
        type="search"
        placeholder="🔍 Buscar un sitio..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-2 w-full rounded border px-3 py-2 text-sm"
      />

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

      <VisitMap
        places={mapPlaces}
        zone={zone}
        partnerLabel={partnerName ?? 'Tu pareja'}
        onSelectPlace={handleSelectPlace}
      />

      <button
        onClick={() => setShowList((s) => !s)}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900"
      >
        <span>Lista de sitios ({countPlaces(personFiltered)})</span>
        <span>{showList ? '▲' : '▼'}</span>
      </button>

      {showList && (
        <div className="mt-2">
          {sections.map((section) => (
            <div key={section.key} className="mb-3">
              {personFilter === 'all' && (
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {section.label} ({countPlaces(section.visits)})
                </h3>
              )}
              {groupByPlace(section.visits).map(renderPlaceCard)}
            </div>
          ))}

          {personFiltered.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              {searchQuery.trim()
                ? `No hay ningún sitio que coincida con "${searchQuery.trim()}".`
                : 'Todavía no hay sitios visitados aquí.'}
            </p>
          )}
        </div>
      )}

      {showForm ? (
        <AddVisitForm
          spaceId={spaceId}
          existingPlaceNames={existingPlaceNames}
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

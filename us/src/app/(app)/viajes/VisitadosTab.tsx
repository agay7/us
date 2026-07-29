// src/app/(app)/viajes/VisitadosTab.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatVisitSummary, type Participant } from '@/lib/viajes/formatVisit'
import type { Zone } from '@/lib/viajes/zones'
import AddVisitForm from './AddVisitForm'

type VisitRow = {
  id: string
  visited_at: string
  places: { name: string; scope: Zone } | null
  place_visit_participants: { user_id: string; profiles: { display_name: string } | null }[]
  visit_photos: { id: string }[]
}

export default function VisitadosTab({ spaceId, zone }: { spaceId: string; zone: Zone | 'all' }) {
  const [visits, setVisits] = useState<VisitRow[]>([])
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
        'id, visited_at, places(name, scope), place_visit_participants(user_id, profiles(display_name)), visit_photos(id)'
      )
      .eq('space_id', spaceId)
      .order('visited_at', { ascending: false })

    if (requestId !== requestIdRef.current) return // a newer request already landed; discard this stale response

    setVisits((data as unknown as VisitRow[]) ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  const filtered = visits.filter((v) => zone === 'all' || v.places?.scope === zone)

  if (loading) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  return (
    <div className="p-3">
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

// src/app/(app)/viajes/PendientesTab.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mergeWishlists, type WishlistEntry } from '@/lib/viajes/wishlistMerge'
import { usePartnerName } from '@/lib/viajes/usePartnerName'
import { zoneLabel, type Zone } from '@/lib/viajes/zones'
import AddWishlistForm from './AddWishlistForm'

type WishlistRow = {
  id: string
  rank: number
  user_id: string
  places: { id: string; name: string; scope: Zone } | null
  profiles: { display_name: string } | null
}

export default function PendientesTab({
  spaceId,
  zone,
}: {
  spaceId: string
  zone: Zone | 'all'
}) {
  const [rows, setRows] = useState<WishlistRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const partnerName = usePartnerName(spaceId, currentUserId)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('place_wishlist')
      .select('id, rank, user_id, places(id, name, scope), profiles(display_name)')
      .eq('space_id', spaceId)
      .order('rank', { ascending: true })

    if (requestId !== requestIdRef.current) return // a newer request already landed; discard this stale response

    setRows((data as unknown as WishlistRow[]) ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  async function handleDelete(wishlistId: string) {
    if (!window.confirm('¿Eliminar este sitio de tu lista de pendientes?')) return

    const supabase = createClient()
    const { error } = await supabase.rpc('delete_wishlist_item', { p_wishlist_id: wishlistId })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  const zoneRows = rows.filter((r) => r.places && (zone === 'all' || r.places.scope === zone))

  // Mirrors the Visitados tab's three sections: mutual places first, then
  // each person's own ranking — computed from the zone-filtered rows so a
  // mutual place never also shows up again under someone's personal list.
  const { mutualItems, myRows, partnerRows } = useMemo(() => {
    const entries: WishlistEntry[] = zoneRows.map((r) => ({
      placeId: r.places!.id,
      placeName: r.places!.name,
      zone: r.places!.scope,
      userId: r.user_id,
      displayName: r.profiles?.display_name ?? 'Alguien',
      rank: r.rank,
    }))

    const mutualItems = mergeWishlists(entries).filter((item) => item.isMutual)
    const mutualPlaceIds = new Set(mutualItems.map((item) => item.placeId))

    const myRows = zoneRows
      .filter((r) => r.user_id === currentUserId && !mutualPlaceIds.has(r.places!.id))
      .sort((a, b) => a.rank - b.rank)

    const partnerRows = zoneRows
      .filter((r) => r.user_id !== currentUserId && !mutualPlaceIds.has(r.places!.id))
      .sort((a, b) => a.rank - b.rank)

    return { mutualItems, myRows, partnerRows }
  }, [zoneRows, currentUserId])

  const totalCount = mutualItems.length + myRows.length + partnerRows.length

  if (loading) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  return (
    <div className="p-3">
      {mutualItems.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            En común ({mutualItems.length})
          </h3>
          {mutualItems.map((item, index) => {
            const myRow = rows.find((r) => r.places?.id === item.placeId && r.user_id === currentUserId)
            return (
              <div
                key={item.placeId}
                className="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 p-2 text-gray-900"
              >
                <b className="w-5">{index + 1}</b>
                <div className="flex-1">
                  <p className="font-bold">{item.placeName}</p>
                  <p className="text-xs opacity-80">
                    {zoneLabel(item.zone)} · {item.topForLabel}
                  </p>
                </div>
                {myRow && (
                  <button onClick={() => handleDelete(myRow.id)} className="shrink-0 text-xs text-red-600">
                    Eliminar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {myRows.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tú ({myRows.length})
          </h3>
          {myRows.map((row, index) => (
            <div
              key={row.id}
              className="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 p-2 text-gray-900"
            >
              <b className="w-5">{index + 1}</b>
              <div className="flex-1">
                <p className="font-bold">{row.places!.name}</p>
                <p className="text-xs opacity-80">{zoneLabel(row.places!.scope)}</p>
              </div>
              <button onClick={() => handleDelete(row.id)} className="shrink-0 text-xs text-red-600">
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {partnerRows.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {partnerName ?? 'Tu pareja'} ({partnerRows.length})
          </h3>
          {partnerRows.map((row, index) => (
            <div
              key={row.id}
              className="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 p-2 text-gray-900"
            >
              <b className="w-5">{index + 1}</b>
              <div className="flex-1">
                <p className="font-bold">{row.places!.name}</p>
                <p className="text-xs opacity-80">{zoneLabel(row.places!.scope)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalCount === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">Todavía no hay sitios pendientes.</p>
      )}

      {showForm ? (
        <AddWishlistForm
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
          + Añadir a pendientes
        </button>
      )}
    </div>
  )
}

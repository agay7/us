// src/app/(app)/viajes/PendientesTab.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mergeWishlists, type WishlistEntry } from '@/lib/viajes/wishlistMerge'
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
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('place_wishlist')
      .select('id, rank, user_id, places(id, name, scope), profiles(display_name)')
      .eq('space_id', spaceId)
      .order('rank', { ascending: true })

    setRows((data as unknown as WishlistRow[]) ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  const entries: WishlistEntry[] = rows
    .filter((r) => r.places)
    .map((r) => ({
      placeId: r.places!.id,
      placeName: r.places!.name,
      zone: r.places!.scope,
      userId: r.user_id,
      displayName: r.profiles?.display_name ?? 'Alguien',
      rank: r.rank,
    }))

  const merged = mergeWishlists(entries).filter((item) => zone === 'all' || item.zone === zone)

  if (loading) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  return (
    <div className="p-3">
      {merged.map((item, index) => (
        <div key={item.placeId} className="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 p-2 text-gray-900">
          <b className="w-5">{index + 1}</b>
          <div className="flex-1">
            <p className="font-bold">{item.placeName}</p>
            <p className="text-xs opacity-80">
              {zoneLabel(item.zone)} · {item.topForLabel}
            </p>
          </div>
        </div>
      ))}

      {merged.length === 0 && (
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

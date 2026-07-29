// src/app/(app)/viajes/AddWishlistForm.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ZONES, type Zone } from '@/lib/viajes/zones'

export default function AddWishlistForm({
  spaceId,
  onDone,
}: {
  spaceId: string
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [zone, setZone] = useState<Zone>('spain')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { data: placeId, error: placeError } = await supabase.rpc('find_or_create_place', {
      p_name: name,
      p_scope: zone,
    })
    if (placeError) {
      setLoading(false)
      setError(placeError.message)
      return
    }

    const { error: wishlistError } = await supabase.rpc('add_wishlist_item', {
      p_space_id: spaceId,
      p_place_id: placeId,
    })
    if (wishlistError) {
      setLoading(false)
      setError(
        wishlistError.message === 'already_in_wishlist'
          ? 'Ese sitio ya está en tu lista.'
          : wishlistError.message
      )
      return
    }

    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <label htmlFor="wishlist-place-name" className="sr-only">
        Nombre del sitio
      </label>
      <input
        id="wishlist-place-name"
        required
        autoComplete="off"
        placeholder="Ej. Japón"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <label htmlFor="wishlist-place-zone" className="sr-only">
        Zona
      </label>
      <select
        id="wishlist-place-zone"
        value={zone}
        onChange={(e) => setZone(e.target.value as Zone)}
        className="rounded border px-3 py-2"
      >
        {ZONES.map((z) => (
          <option key={z.value} value={z.value}>
            {z.icon} {z.label}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Añadiendo...' : 'Añadir'}
      </button>
    </form>
  )
}

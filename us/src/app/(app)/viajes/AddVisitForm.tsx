// src/app/(app)/viajes/AddVisitForm.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ZONES, type Zone } from '@/lib/viajes/zones'

export default function AddVisitForm({
  spaceId,
  onDone,
}: {
  spaceId: string
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [zone, setZone] = useState<Zone>('spain')
  const [together, setTogether] = useState(true)
  const [month, setMonth] = useState('')
  const [photos, setPhotos] = useState<FileList | null>(null)
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

    const { data: visitId, error: visitError } = await supabase.rpc('add_visit', {
      p_space_id: spaceId,
      p_place_id: placeId,
      p_visited_at: `${month}-01`,
      p_note: null,
      p_together: together,
    })
    if (visitError) {
      setLoading(false)
      setError(visitError.message)
      return
    }

    if (photos) {
      for (const file of Array.from(photos)) {
        const path = `${spaceId}/${visitId}/${crypto.randomUUID()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('visit-photos').upload(path, file)
        if (uploadError) {
          setLoading(false)
          setError(uploadError.message)
          return
        }
        await supabase.rpc('add_visit_photo', { p_visit_id: visitId, p_url: path })
      }
    }

    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <label htmlFor="place-name" className="sr-only">
        Nombre del sitio
      </label>
      <input
        id="place-name"
        required
        autoComplete="off"
        placeholder="Ej. Roma, Italia"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <label htmlFor="place-zone" className="sr-only">
        Zona
      </label>
      <select
        id="place-zone"
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

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={together} onChange={(e) => setTogether(e.target.checked)} />
        Fuimos juntos
      </label>

      <label htmlFor="visit-month" className="sr-only">
        Mes y año de la visita
      </label>
      <input
        id="visit-month"
        type="month"
        required
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <label htmlFor="visit-photos" className="text-sm">
        Fotos (opcional)
      </label>
      <input
        id="visit-photos"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setPhotos(e.target.files)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}

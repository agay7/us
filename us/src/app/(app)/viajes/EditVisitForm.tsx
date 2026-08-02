'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EditVisitForm({
  spaceId,
  visitId,
  initialMonth,
  initialTogether,
  hasPartner,
  partnerName,
  onDone,
  onCancel,
}: {
  spaceId: string
  visitId: string
  initialMonth: string
  initialTogether: boolean
  hasPartner: boolean
  partnerName: string | null
  onDone: () => void
  onCancel: () => void
}) {
  const [month, setMonth] = useState(initialMonth)
  const [together, setTogether] = useState(initialTogether)
  const [photos, setPhotos] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { error: updateError } = await supabase.rpc('update_visit', {
      p_visit_id: visitId,
      p_visited_at: month ? `${month}-01` : null,
      p_together: hasPartner && together,
    })
    if (updateError) {
      setLoading(false)
      setError(updateError.message)
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
    <form
      onSubmit={handleSubmit}
      className="mt-2 flex flex-col gap-2 rounded-xl border border-blue-200 bg-white p-3"
    >
      <label htmlFor={`edit-month-${visitId}`} className="text-sm">
        Mes y año de la visita
      </label>
      <input
        id={`edit-month-${visitId}`}
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasPartner && together}
          disabled={!hasPartner}
          onChange={(e) => setTogether(e.target.checked)}
        />
        {partnerName ? `Fuimos juntos (con ${partnerName})` : 'Fuimos juntos'}
      </label>
      {!hasPartner && (
        <p className="text-xs text-gray-500">Tu pareja todavía no se ha unido a este space.</p>
      )}

      <label htmlFor={`edit-photos-${visitId}`} className="text-sm">
        Añadir más fotos (opcional)
      </label>
      <input
        id={`edit-photos-${visitId}`}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setPhotos(e.target.files)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded bg-blue-600 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded border py-2 text-gray-700">
          Cancelar
        </button>
      </div>
    </form>
  )
}

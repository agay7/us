'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProposeChallengeForm({
  spaceId,
  hasPartner,
  partnerId,
  partnerName,
  onDone,
}: {
  spaceId: string
  hasPartner: boolean
  partnerId: string | null
  partnerName: string | null
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<'one_off' | 'streak'>('one_off')
  const [points, setPoints] = useState('10')
  const [target, setTarget] = useState<'both' | 'partner'>('both')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: proposeError } = await supabase.rpc('propose_challenge', {
      p_space_id: spaceId,
      p_title: title,
      p_description: description || null,
      p_kind: kind,
      p_points: Number(points),
      p_assigned_to: target === 'partner' && hasPartner ? partnerId : null,
    })

    setLoading(false)

    if (proposeError) {
      setError(proposeError.message)
      return
    }

    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <label htmlFor="challenge-title" className="sr-only">
        Título del reto
      </label>
      <input
        id="challenge-title"
        required
        autoComplete="off"
        placeholder="Ej. Cocinar una receta nueva"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <label htmlFor="challenge-description" className="sr-only">
        Descripción (opcional)
      </label>
      <textarea
        id="challenge-description"
        placeholder="Descripción (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="rounded border px-3 py-2"
        rows={2}
      />

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="kind"
            checked={kind === 'one_off'}
            onChange={() => setKind('one_off')}
          />
          Puntual
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" checked={kind === 'streak'} onChange={() => setKind('streak')} />
          Racha
        </label>
      </div>

      <label htmlFor="challenge-points" className="text-sm">
        Puntos
      </label>
      <input
        id="challenge-points"
        type="number"
        min={1}
        required
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <label htmlFor="challenge-target" className="text-sm">
        ¿Para quién?
      </label>
      <select
        id="challenge-target"
        value={target}
        onChange={(e) => setTarget(e.target.value as 'both' | 'partner')}
        className="rounded border px-3 py-2"
      >
        <option value="both">Para los dos</option>
        <option value="partner" disabled={!hasPartner}>
          Para {partnerName ?? 'tu pareja'}
        </option>
      </select>
      {!hasPartner && (
        <p className="text-xs text-gray-500">Tu pareja todavía no se ha unido a este space.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Proponiendo...' : 'Proponer reto'}
      </button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type GoalCategory = 'savings' | 'habit' | 'life'

export default function AddGoalForm({ spaceId, onDone }: { spaceId: string; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<GoalCategory>('savings')
  const [targetAmount, setTargetAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: createError } = await supabase.rpc('create_goal', {
      p_space_id: spaceId,
      p_title: title,
      p_category: category,
      p_target_amount: category === 'savings' ? Number(targetAmount) : null,
    })

    setLoading(false)

    if (createError) {
      setError(createError.message)
      return
    }

    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <label htmlFor="goal-title" className="sr-only">
        Título del objetivo
      </label>
      <input
        id="goal-title"
        required
        autoComplete="off"
        placeholder="Ej. Ahorrar viaje a Japón"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <label htmlFor="goal-category" className="text-sm">
        Categoría
      </label>
      <select
        id="goal-category"
        value={category}
        onChange={(e) => setCategory(e.target.value as GoalCategory)}
        className="rounded border px-3 py-2"
      >
        <option value="savings">💰 Ahorro</option>
        <option value="habit">🔁 Hábito</option>
        <option value="life">🌱 Vida</option>
      </select>

      {category === 'savings' && (
        <>
          <label htmlFor="goal-target" className="text-sm">
            Cantidad objetivo (€)
          </label>
          <input
            id="goal-target"
            type="number"
            min={1}
            step="0.01"
            required
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear objetivo'}
      </button>
    </form>
  )
}

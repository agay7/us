'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpaceId } from '@/lib/space-context'
import { createClient } from '@/lib/supabase/client'
import { usePartnerInfo } from '@/lib/usePartnerName'
import { computeStreakWeeks } from '@/lib/streak'
import { savingsProgress, milestoneProgress } from '@/lib/objetivos/progress'
import AddGoalForm from './AddGoalForm'

type GoalCategory = 'savings' | 'habit' | 'life'
type GoalStatus = 'active' | 'completed'

type GoalRow = {
  id: string
  title: string
  category: GoalCategory
  status: GoalStatus
  target_amount: number | null
  current_amount: number
  created_by: string
}

type MilestoneRow = { id: string; goal_id: string; title: string; completed: boolean }

type CheckinRow = { id: string; goal_id: string; user_id: string; date: string }

const CATEGORY_ICON: Record<GoalCategory, string> = { savings: '💰', habit: '🔁', life: '🌱' }

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function ContributionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (amount: number) => void
  onCancel: () => void
}) {
  const [amount, setAmount] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const n = Number(amount)
        if (n) onSubmit(n)
      }}
      className="mt-2 flex gap-2"
    >
      <label htmlFor="contribution-amount" className="sr-only">
        Cantidad
      </label>
      <input
        id="contribution-amount"
        type="number"
        step="0.01"
        placeholder="€ (usa negativo para corregir)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="flex-1 rounded border px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-xs text-white">
        Añadir
      </button>
      <button type="button" onClick={onCancel} className="rounded border px-3 py-1 text-xs">
        Cancelar
      </button>
    </form>
  )
}

function MilestoneForm({ onSubmit, onCancel }: { onSubmit: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim()) onSubmit(title.trim())
      }}
      className="mt-2 flex gap-2"
    >
      <label htmlFor="milestone-title" className="sr-only">
        Nuevo hito
      </label>
      <input
        id="milestone-title"
        placeholder="Nuevo hito"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 rounded border px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-xs text-white">
        Añadir
      </button>
      <button type="button" onClick={onCancel} className="rounded border px-3 py-1 text-xs">
        Cancelar
      </button>
    </form>
  )
}

export default function ObjetivosPage() {
  const spaceId = useSpaceId()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { partnerId, partnerName } = usePartnerInfo(spaceId, currentUserId)
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [milestones, setMilestones] = useState<MilestoneRow[]>([])
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [categoryFilter, setCategoryFilter] = useState<'all' | GoalCategory>('all')
  const [openContribFor, setOpenContribFor] = useState<string | null>(null)
  const [openMilestoneFor, setOpenMilestoneFor] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    const supabase = createClient()

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id ?? null
    if (requestId !== requestIdRef.current) return
    setCurrentUserId(uid)

    const [{ data: goalsData }, { data: milestonesData }, { data: checkinsData }] = await Promise.all([
      supabase
        .from('goals')
        .select('id, title, category, status, target_amount, current_amount, created_by')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('goal_milestones')
        .select('id, goal_id, title, completed')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: true }),
      supabase.from('habit_checkins').select('id, goal_id, user_id, date').eq('space_id', spaceId),
    ])

    if (requestId !== requestIdRef.current) return // a newer request already landed; discard this stale response

    setGoals((goalsData as GoalRow[]) ?? [])
    setMilestones((milestonesData as MilestoneRow[]) ?? [])
    setCheckins((checkinsData as CheckinRow[]) ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  async function handleContribute(goalId: string, amount: number) {
    const supabase = createClient()
    const { error } = await supabase.rpc('add_savings_contribution', { p_goal_id: goalId, p_amount: amount })
    setOpenContribFor(null)
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  async function handleAddMilestone(goalId: string, title: string) {
    const supabase = createClient()
    const { error } = await supabase.rpc('add_milestone', { p_goal_id: goalId, p_title: title })
    setOpenMilestoneFor(null)
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  async function handleToggleMilestone(milestoneId: string, completed: boolean) {
    const supabase = createClient()
    const { error } = await supabase.rpc('toggle_milestone', { p_milestone_id: milestoneId, p_completed: completed })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  async function handleCheckin(goalId: string) {
    const supabase = createClient()
    const { error } = await supabase.rpc('checkin_habit', { p_goal_id: goalId })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  async function handleDelete(goalId: string) {
    if (!window.confirm('¿Eliminar este objetivo? No se puede deshacer.')) return

    const supabase = createClient()
    const { error } = await supabase.rpc('delete_goal', { p_goal_id: goalId })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  const filtered = goals.filter((g) => categoryFilter === 'all' || g.category === categoryFilter)

  if (loading) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  return (
    <main className="pb-4">
      <h1 className="p-3 pb-0 text-2xl font-bold">Objetivos</h1>

      <div className="flex flex-wrap gap-2 p-3 text-xs">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`rounded-full border px-3 py-1 ${categoryFilter === 'all' ? '' : 'opacity-50'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setCategoryFilter('savings')}
          className={`rounded-full border px-3 py-1 ${categoryFilter === 'savings' ? '' : 'opacity-50'}`}
        >
          💰 Ahorro
        </button>
        <button
          onClick={() => setCategoryFilter('habit')}
          className={`rounded-full border px-3 py-1 ${categoryFilter === 'habit' ? '' : 'opacity-50'}`}
        >
          🔁 Hábitos
        </button>
        <button
          onClick={() => setCategoryFilter('life')}
          className={`rounded-full border px-3 py-1 ${categoryFilter === 'life' ? '' : 'opacity-50'}`}
        >
          🌱 Vida
        </button>
      </div>

      <div className="p-3">
        {filtered.map((g) => {
          const isCreator = g.created_by === currentUserId

          return (
            <div key={g.id} className="mb-2 rounded-xl bg-gray-100 p-3 text-gray-900">
              <div className="flex items-start justify-between gap-2">
                <b>
                  {CATEGORY_ICON[g.category]} {g.title}
                </b>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {g.status === 'completed' && <span>🎉</span>}
                  {isCreator && (
                    <button onClick={() => handleDelete(g.id)} className="text-red-600">
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              {g.category === 'savings' && (
                <>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="h-2 w-full max-w-[70%] overflow-hidden rounded bg-gray-300">
                      <span
                        className="block h-2 rounded bg-blue-500"
                        style={{ width: `${savingsProgress(g.current_amount, g.target_amount ?? 0)}%` }}
                      />
                    </span>
                    <span>{savingsProgress(g.current_amount, g.target_amount ?? 0)}%</span>
                  </div>
                  <p className="mt-1 text-xs opacity-80">
                    {g.current_amount}€ / {g.target_amount}€
                  </p>
                  {openContribFor === g.id ? (
                    <ContributionForm
                      onSubmit={(amount) => handleContribute(g.id, amount)}
                      onCancel={() => setOpenContribFor(null)}
                    />
                  ) : (
                    <button onClick={() => setOpenContribFor(g.id)} className="mt-2 text-xs text-blue-600">
                      + Añadir aportación
                    </button>
                  )}
                </>
              )}

              {g.category === 'habit' && (
                <>
                  <p className="mt-1 text-xs opacity-80">
                    🔥 Racha: Tú{' '}
                    {computeStreakWeeks(
                      checkins.filter((c) => c.goal_id === g.id && c.user_id === currentUserId).map((c) => c.date)
                    )}{' '}
                    sem.
                    {partnerId &&
                      ` · ${partnerName} ${computeStreakWeeks(
                        checkins.filter((c) => c.goal_id === g.id && c.user_id === partnerId).map((c) => c.date)
                      )} sem.`}
                  </p>
                  {(() => {
                    const checkedInToday = checkins.some(
                      (c) => c.goal_id === g.id && c.user_id === currentUserId && c.date === todayStr()
                    )
                    return (
                      <button
                        disabled={checkedInToday}
                        onClick={() => handleCheckin(g.id)}
                        className="mt-2 text-xs text-blue-600 disabled:text-gray-400"
                      >
                        {checkedInToday ? '✅ Hecho hoy' : 'Marcar hoy'}
                      </button>
                    )
                  })()}
                </>
              )}

              {g.category === 'life' && (
                <>
                  {(() => {
                    const goalMilestones = milestones.filter((m) => m.goal_id === g.id)
                    const pct = milestoneProgress(goalMilestones.filter((m) => m.completed).length, goalMilestones.length)
                    return (
                      <>
                        <div className="mt-1 flex items-center justify-between text-sm">
                          <span className="h-2 w-full max-w-[70%] overflow-hidden rounded bg-gray-300">
                            <span className="block h-2 rounded bg-blue-500" style={{ width: `${pct}%` }} />
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <ul className="mt-2 text-xs">
                          {goalMilestones.map((m) => (
                            <li
                              key={m.id}
                              onClick={() => handleToggleMilestone(m.id, !m.completed)}
                              className="cursor-pointer py-0.5"
                            >
                              {m.completed ? '✅' : '⬜'} {m.title}
                            </li>
                          ))}
                        </ul>
                      </>
                    )
                  })()}
                  {openMilestoneFor === g.id ? (
                    <MilestoneForm
                      onSubmit={(title) => handleAddMilestone(g.id, title)}
                      onCancel={() => setOpenMilestoneFor(null)}
                    />
                  ) : (
                    <button onClick={() => setOpenMilestoneFor(g.id)} className="mt-2 text-xs text-blue-600">
                      + Añadir hito
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">Todavía no hay objetivos aquí.</p>
        )}

        {showForm ? (
          <AddGoalForm
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
            + Nuevo objetivo
          </button>
        )}
      </div>
    </main>
  )
}

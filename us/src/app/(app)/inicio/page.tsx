'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSpaceId } from '@/lib/space-context'
import { createClient } from '@/lib/supabase/client'
import { usePartnerInfo } from '@/lib/usePartnerName'
import { computeLeaderboard, type PointEntry } from '@/lib/retos/points'
import { savingsProgress, milestoneProgress } from '@/lib/objetivos/progress'

type VisitRow = { id: string; place_visit_participants: { user_id: string }[] }

type ChallengeRow = {
  id: string
  title: string
  points: number
  status: string
  created_by: string
  assigned_to: string | null
  created_at: string
}
type CompletionRow = { user_id: string; challenge_id: string; completed_at: string }

type GoalRow = {
  id: string
  title: string
  category: 'savings' | 'habit' | 'life'
  status: string
  target_amount: number | null
  current_amount: number
}
type MilestoneRow = {
  id: string
  goal_id: string
  completed: boolean
  completed_at: string | null
  goals: { title: string } | null
}
type CheckinRow = { id: string; goal_id: string; user_id: string; date: string; goals: { title: string } | null }
type PhotoRow = {
  id: string
  visit_id: string
  uploaded_by: string
  created_at: string
  place_visits: { places: { name: string } | null } | null
}

type ActivityEvent = { key: string; icon: string; text: string; at: number }

export default function InicioPage() {
  const spaceId = useSpaceId()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { partnerId, partnerName } = usePartnerInfo(spaceId, currentUserId)
  const [spaceName, setSpaceName] = useState<string | null>(null)

  const [visits, setVisits] = useState<VisitRow[]>([])
  const [challenges, setChallenges] = useState<ChallengeRow[]>([])
  const [completions, setCompletions] = useState<CompletionRow[]>([])
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [milestones, setMilestones] = useState<MilestoneRow[]>([])
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [photos, setPhotos] = useState<PhotoRow[]>([])
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

    const [
      { data: spaceData },
      { data: visitsData },
      { data: challengesData },
      { data: completionsData },
      { data: goalsData },
      { data: milestonesData },
      { data: checkinsData },
      { data: photosData },
    ] = await Promise.all([
      supabase.from('spaces').select('name').eq('id', spaceId).maybeSingle(),
      supabase.from('place_visits').select('id, place_visit_participants(user_id)').eq('space_id', spaceId),
      supabase
        .from('challenges')
        .select('id, title, points, status, created_by, assigned_to, created_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: true }),
      // Unlimited: the points leaderboard needs every completion ever
      // made, not just the most recent ones — the final activity feed
      // below takes care of capping what's shown on screen.
      supabase
        .from('challenge_completions')
        .select('user_id, challenge_id, completed_at')
        .eq('space_id', spaceId),
      supabase
        .from('goals')
        .select('id, title, category, status, target_amount, current_amount')
        .eq('space_id', spaceId),
      supabase
        .from('goal_milestones')
        .select('id, goal_id, completed, completed_at, goals(title)')
        .eq('space_id', spaceId),
      supabase
        .from('habit_checkins')
        .select('id, goal_id, user_id, date, goals(title)')
        .eq('space_id', spaceId)
        .order('date', { ascending: false })
        .limit(5),
      supabase
        .from('visit_photos')
        .select('id, visit_id, uploaded_by, created_at, place_visits(places(name))')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    if (requestId !== requestIdRef.current) return // a newer request already landed; discard this stale response

    setSpaceName((spaceData as { name: string } | null)?.name ?? null)
    setVisits((visitsData as unknown as VisitRow[]) ?? [])
    setChallenges((challengesData as ChallengeRow[]) ?? [])
    setCompletions((completionsData as CompletionRow[]) ?? [])
    setGoals((goalsData as GoalRow[]) ?? [])
    setMilestones((milestonesData as unknown as MilestoneRow[]) ?? [])
    setCheckins((checkinsData as unknown as CheckinRow[]) ?? [])
    setPhotos((photosData as unknown as PhotoRow[]) ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  function nameFor(userId: string): string {
    if (userId === currentUserId) return 'Tú'
    return partnerName ?? 'Tu pareja'
  }

  if (loading || currentUserId === null) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  // --- Viajes summary ---
  const togetherCount = visits.filter((v) => v.place_visit_participants.length >= 2).length
  const soloCount = visits.filter((v) => v.place_visit_participants.length === 1).length

  // --- Retos summary ---
  const leaderboardEntries: PointEntry[] = completions
    .map((c) => {
      const challenge = challenges.find((ch) => ch.id === c.challenge_id)
      return challenge ? { userId: c.user_id, points: challenge.points } : null
    })
    .filter((e): e is PointEntry => e !== null)
  const leaderboard = computeLeaderboard(leaderboardEntries)
  const leaderboardIds = [currentUserId, partnerId].filter((id): id is string => id !== null)
  const pendingChallenge = challenges.find((c) => c.status === 'pending_acceptance')

  // --- Objetivos summary ---
  const activeGoals = goals.filter((g) => g.status === 'active')
  const goalProgress = (g: GoalRow): number | null => {
    if (g.category === 'savings') return savingsProgress(g.current_amount, g.target_amount ?? 0)
    if (g.category === 'life') {
      const own = milestones.filter((m) => m.goal_id === g.id)
      return own.length > 0 ? milestoneProgress(own.filter((m) => m.completed).length, own.length) : null
    }
    return null
  }
  const highlightGoal = activeGoals
    .map((g) => ({ goal: g, pct: goalProgress(g) }))
    .filter((x): x is { goal: GoalRow; pct: number } => x.pct !== null)
    .sort((a, b) => b.pct - a.pct)[0]

  // --- Recent activity (merged from the modules' own tables — no dedicated feed table yet) ---
  const photoEvents: ActivityEvent[] = (() => {
    const groups = new Map<string, { uploadedBy: string; placeName: string; count: number; at: number }>()
    for (const p of photos) {
      const key = `${p.visit_id}:${p.uploaded_by}`
      const at = new Date(p.created_at).getTime()
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
        existing.at = Math.max(existing.at, at)
      } else {
        groups.set(key, {
          uploadedBy: p.uploaded_by,
          placeName: p.place_visits?.places?.name ?? 'un sitio',
          count: 1,
          at,
        })
      }
    }
    return Array.from(groups.values()).map((g) => ({
      key: `photo-${g.at}-${g.uploadedBy}`,
      icon: '📸',
      text: `${nameFor(g.uploadedBy)} subió ${g.count} foto${g.count === 1 ? '' : 's'} de ${g.placeName}`,
      at: g.at,
    }))
  })()

  const completionEvents: ActivityEvent[] = completions.map((c) => {
    const title = challenges.find((ch) => ch.id === c.challenge_id)?.title ?? 'un reto'
    return {
      key: `completion-${c.challenge_id}-${c.user_id}-${c.completed_at}`,
      icon: '✅',
      text: `${nameFor(c.user_id)} completó el reto "${title}"`,
      at: new Date(c.completed_at).getTime(),
    }
  })

  const milestoneEvents: ActivityEvent[] = milestones
    .filter((m) => m.completed && m.completed_at)
    .map((m) => ({
      key: `milestone-${m.id}`,
      icon: '🎯',
      text: `Hito completado en "${m.goals?.title ?? 'un objetivo'}"`,
      at: new Date(m.completed_at as string).getTime(),
    }))

  const checkinEvents: ActivityEvent[] = checkins.map((c) => ({
    key: `checkin-${c.id}`,
    icon: '🔁',
    text: `${nameFor(c.user_id)} marcó "${c.goals?.title ?? 'un hábito'}"`,
    at: new Date(`${c.date}T00:00:00Z`).getTime(),
  }))

  const recentActivity = [...photoEvents, ...completionEvents, ...milestoneEvents, ...checkinEvents]
    .sort((a, b) => b.at - a.at)
    .slice(0, 3)

  return (
    <main className="pb-4">
      <h1 className="p-3 pb-0 text-2xl font-bold">{spaceName ?? 'Inicio'}</h1>

      <div className="flex flex-col gap-3 p-3">
        <section className="rounded-xl bg-gray-100 p-3 text-gray-900">
          <h2 className="text-sm font-semibold">✈️ Viajes</h2>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-sm">
              {togetherCount} visitados juntos · {soloCount} en solitario
            </p>
            <Link href="/viajes" className="shrink-0 rounded border border-blue-600 px-3 py-1 text-xs text-blue-600">
              Ver mapa
            </Link>
          </div>
        </section>

        <section className="rounded-xl bg-gray-100 p-3 text-gray-900">
          <h2 className="text-sm font-semibold">🏆 Retos</h2>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-sm">
              {leaderboardIds.map((id) => `${nameFor(id)} ${leaderboard[id] ?? 0} pts`).join(' · ') || 'Sin puntos todavía'}
            </p>
            <Link href="/retos" className="shrink-0 rounded border border-blue-600 px-3 py-1 text-xs text-blue-600">
              Ver retos
            </Link>
          </div>
          {pendingChallenge && (
            <p className="mt-2 text-xs opacity-80">
              🔥 Reto pendiente: &quot;{pendingChallenge.title}&quot; —{' '}
              {pendingChallenge.assigned_to
                ? `esperando que ${nameFor(pendingChallenge.assigned_to)} lo acepte`
                : 'pendiente de aceptar'}
            </p>
          )}
        </section>

        <section className="rounded-xl bg-gray-100 p-3 text-gray-900">
          <h2 className="text-sm font-semibold">🎯 Objetivos</h2>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-sm">
              {activeGoals.length} activo{activeGoals.length === 1 ? '' : 's'}
              {highlightGoal ? ` · "${highlightGoal.goal.title}" ${highlightGoal.pct}%` : ''}
            </p>
            <Link
              href="/objetivos"
              className="shrink-0 rounded border border-blue-600 px-3 py-1 text-xs text-blue-600"
            >
              Ver objetivos
            </Link>
          </div>
        </section>

        {recentActivity.length > 0 && (
          <section>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Actividad reciente
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {recentActivity.map((e) => (
                <li key={e.key}>
                  {e.icon} {e.text}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

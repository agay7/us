'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSpaceId } from '@/lib/space-context'
import { createClient } from '@/lib/supabase/client'
import { usePartnerInfo } from '@/lib/usePartnerName'
import { computeLeaderboard, type PointEntry } from '@/lib/retos/points'
import { computeStreakWeeks } from '@/lib/retos/streak'
import ProposeChallengeForm from './ProposeChallengeForm'

type ChallengeStatus = 'pending_acceptance' | 'active' | 'completed' | 'declined'
type ChallengeKind = 'one_off' | 'streak'

type ChallengeRow = {
  id: string
  title: string
  description: string | null
  kind: ChallengeKind
  points: number
  status: ChallengeStatus
  created_by: string
  assigned_to: string | null
}

type CompletionRow = {
  id: string
  challenge_id: string
  user_id: string
  completed_at: string
}

type AchievementRow = { id: string; code: string; name: string; icon: string; criteria: string }

export default function RetosPage() {
  const spaceId = useSpaceId()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { partnerId, partnerName } = usePartnerInfo(spaceId, currentUserId)
  const [challenges, setChallenges] = useState<ChallengeRow[]>([])
  const [completions, setCompletions] = useState<CompletionRow[]>([])
  const [achievements, setAchievements] = useState<AchievementRow[]>([])
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
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

    const [{ data: challengesData }, { data: completionsData }, { data: achievementsData }, { data: unlockedData }] =
      await Promise.all([
        supabase
          .from('challenges')
          .select('id, title, description, kind, points, status, created_by, assigned_to')
          .eq('space_id', spaceId)
          .order('created_at', { ascending: false }),
        supabase
          .from('challenge_completions')
          .select('id, challenge_id, user_id, completed_at')
          .eq('space_id', spaceId),
        supabase.from('achievements').select('id, code, name, icon, criteria').order('code'),
        uid
          ? supabase.from('user_achievements').select('achievement_id').eq('space_id', spaceId).eq('user_id', uid)
          : Promise.resolve({ data: [] as { achievement_id: string }[] }),
      ])

    if (requestId !== requestIdRef.current) return // a newer request already landed; discard this stale response

    setChallenges((challengesData as ChallengeRow[]) ?? [])
    setCompletions((completionsData as CompletionRow[]) ?? [])
    setAchievements((achievementsData as AchievementRow[]) ?? [])
    setUnlockedIds(new Set((unlockedData ?? []).map((u) => u.achievement_id)))
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  function nameFor(userId: string): string {
    if (userId === currentUserId) return 'Tú'
    return partnerName ?? 'Tu pareja'
  }

  async function handleRespond(challengeId: string, accept: boolean) {
    const supabase = createClient()
    const { error } = await supabase.rpc('respond_challenge', { p_challenge_id: challengeId, p_accept: accept })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  async function handleComplete(challengeId: string) {
    const supabase = createClient()
    const { error } = await supabase.rpc('complete_challenge', { p_challenge_id: challengeId })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  const leaderboard = useMemo(() => {
    const entries: PointEntry[] = completions
      .map((c) => {
        const challenge = challenges.find((ch) => ch.id === c.challenge_id)
        return challenge ? { userId: c.user_id, points: challenge.points } : null
      })
      .filter((e): e is PointEntry => e !== null)
    return computeLeaderboard(entries)
  }, [completions, challenges])

  const sortedLeaderboard = useMemo(() => {
    const ids = [currentUserId, partnerId].filter((id): id is string => id !== null)
    return ids.map((id) => ({ id, points: leaderboard[id] ?? 0 })).sort((a, b) => b.points - a.points)
  }, [leaderboard, currentUserId, partnerId])

  const pending = challenges.filter((c) => c.status === 'pending_acceptance')
  const active = challenges.filter((c) => c.status === 'active')
  const completedList = challenges.filter((c) => c.status === 'completed')

  function streakLabel(challenge: ChallengeRow): string {
    const relevantUserIds = challenge.assigned_to
      ? [challenge.assigned_to]
      : [currentUserId, partnerId].filter((id): id is string => id !== null)

    const parts = relevantUserIds.map((uid) => {
      const dates = completions
        .filter((c) => c.challenge_id === challenge.id && c.user_id === uid)
        .map((c) => c.completed_at)
      return `${nameFor(uid)} ${computeStreakWeeks(dates)} sem.`
    })

    return `🔥 Racha: ${parts.join(' · ')}`
  }

  if (loading) {
    return <p className="p-4 text-sm text-gray-500">Cargando...</p>
  }

  return (
    <main className="pb-4">
      <h1 className="p-3 pb-0 text-2xl font-bold">Retos</h1>

      {sortedLeaderboard.length > 0 && (
        <div className="mx-3 mt-3 flex justify-around rounded-xl bg-gray-100 p-3 text-gray-900">
          {sortedLeaderboard.map((entry, index) => (
            <div key={entry.id} className="text-center">
              <div className="text-xl">{index === 0 ? '🥇' : '🥈'}</div>
              <b>{nameFor(entry.id)}</b>
              <div className="text-xs opacity-80">{entry.points} pts</div>
            </div>
          ))}
        </div>
      )}

      <div className="p-3">
        {pending.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Pendientes de aceptar
            </h3>
            {pending.map((c) => {
              const isCreator = c.created_by === currentUserId
              const canRespond = !isCreator && (c.assigned_to === null || c.assigned_to === currentUserId)
              return (
                <div
                  key={c.id}
                  className="mb-2 flex items-center gap-2 rounded-xl border border-dashed border-blue-400 bg-gray-100 p-2 text-gray-900"
                >
                  <div className="text-xl">🎁</div>
                  <div className="flex-1">
                    <p className="font-bold">{c.title}</p>
                    <p className="text-xs opacity-80">
                      Propuesto por {nameFor(c.created_by)} · +{c.points} pts
                    </p>
                  </div>
                  {canRespond ? (
                    <div className="flex shrink-0 gap-2 text-xs">
                      <button onClick={() => handleRespond(c.id, true)} className="text-blue-600">
                        Aceptar
                      </button>
                      <button onClick={() => handleRespond(c.id, false)} className="text-red-600">
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-gray-500">Esperando respuesta</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {active.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Activos</h3>
            {active.map((c) => {
              const canComplete = c.assigned_to === null || c.assigned_to === currentUserId
              return (
                <div
                  key={c.id}
                  className="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 p-2 text-gray-900"
                >
                  <div className="text-xl">{c.kind === 'streak' ? '🔥' : '🏃'}</div>
                  <div className="flex-1">
                    <p className="font-bold">{c.title}</p>
                    <p className="text-xs opacity-80">
                      {c.kind === 'streak'
                        ? streakLabel(c)
                        : `+${c.points} pts · ${c.assigned_to ? nameFor(c.assigned_to) : 'Para los dos'}`}
                    </p>
                  </div>
                  {canComplete && (
                    <button onClick={() => handleComplete(c.id)} className="shrink-0 text-xs text-blue-600">
                      Completar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {completedList.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Completados</h3>
            {completedList.map((c) => {
              const completion = completions.find((cc) => cc.challenge_id === c.id)
              return (
                <div key={c.id} className="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 p-2 text-gray-900 opacity-85">
                  <div className="text-xl">✅</div>
                  <div className="flex-1">
                    <p className="font-bold">{c.title}</p>
                    <p className="text-xs opacity-80">
                      Completado por {completion ? nameFor(completion.user_id) : '?'} · +{c.points} pts
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pending.length === 0 && active.length === 0 && completedList.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">Todavía no hay retos propuestos.</p>
        )}

        {achievements.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Tus insignias</h3>
            <div className="flex gap-3 rounded-xl bg-gray-100 p-3 text-2xl">
              {achievements.map((a) => (
                <span key={a.id} title={`${a.name} — ${a.criteria}`} style={{ opacity: unlockedIds.has(a.id) ? 1 : 0.3 }}>
                  {a.icon}
                </span>
              ))}
            </div>
          </div>
        )}

        {showForm ? (
          <ProposeChallengeForm
            spaceId={spaceId}
            hasPartner={partnerId !== null}
            partnerId={partnerId}
            partnerName={partnerName}
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
            + Proponer un reto
          </button>
        )}
      </div>
    </main>
  )
}

export type Participant = { userId: string; displayName: string }

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatVisitSummary(participants: Participant[], visitedAt: string | null): string {
  const who =
    participants.length >= 2
      ? '👫 Juntos'
      : `🧍 ${participants[0]?.displayName ?? 'Alguien'} en solitario`

  if (visitedAt === null) {
    return `${who} · Fecha desconocida`
  }

  const date = new Date(`${visitedAt}T00:00:00`)
  const monthYear = capitalize(date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))

  return `${who} · ${monthYear}`
}

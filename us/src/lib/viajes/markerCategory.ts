export type MarkerCategory = 'together' | 'me' | 'partner'

// Single source of truth for category colors, shared by the map pins
// (VisitMap) and anywhere else that needs to preview or match them (e.g.
// the edit form's "fuimos juntos" indicator).
export const CATEGORY_COLOR: Record<MarkerCategory, string> = {
  together: '#8b5cf6', // violeta
  me: '#f97316', // naranja
  partner: '#14b8a6', // verde azulado
}

// visitsParticipants: one array of participant user ids per visit to a
// single place (a place can have several visits over time). Aggregates
// across all of them, since one marker represents the whole place.
export function getMarkerCategory(
  visitsParticipants: string[][],
  currentUserId: string
): MarkerCategory {
  const uniqueParticipants = new Set(visitsParticipants.flat())

  if (uniqueParticipants.size >= 2) return 'together'
  if (uniqueParticipants.has(currentUserId)) return 'me'
  return 'partner'
}

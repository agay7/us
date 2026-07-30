export type MarkerCategory = 'together' | 'me' | 'partner'

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

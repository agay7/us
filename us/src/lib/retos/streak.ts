// Mirrors the server's compute_streak_weeks (date_trunc('week', ...) in
// Postgres, Monday-start ISO weeks) so the UI can show a challenge's
// current streak without a network round trip per card. This is a
// display-only approximation — the achievement unlock itself is decided
// server-side in the same migration, this just needs to agree with it
// closely enough for the number on screen to make sense.
function mondayStartOfWeekUtcMs(iso: string): number {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7 // 0 = Monday
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function computeStreakWeeks(completedAtDates: string[]): number {
  if (completedAtDates.length === 0) return 0

  const weeks = Array.from(new Set(completedAtDates.map(mondayStartOfWeekUtcMs))).sort((a, b) => b - a)

  let streak = 0
  let expected = weeks[0]
  for (const week of weeks) {
    if (week === expected) {
      streak += 1
      expected -= WEEK_MS
    } else {
      break
    }
  }
  return streak
}

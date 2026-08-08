export type PointEntry = { userId: string; points: number }

export function computeLeaderboard(entries: PointEntry[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const entry of entries) {
    totals[entry.userId] = (totals[entry.userId] ?? 0) + entry.points
  }
  return totals
}

export function savingsProgress(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

export function milestoneProgress(completedCount: number, totalCount: number): number {
  if (totalCount === 0) return 0
  return Math.round((completedCount / totalCount) * 100)
}

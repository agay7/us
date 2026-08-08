import { describe, it, expect } from 'vitest'
import { computeStreakWeeks } from './streak'

describe('computeStreakWeeks', () => {
  it('returns 0 for no completions', () => {
    expect(computeStreakWeeks([])).toBe(0)
  })

  it('counts a single completion as a streak of 1', () => {
    expect(computeStreakWeeks(['2026-08-05T10:00:00Z'])).toBe(1)
  })

  it('counts consecutive weeks with at least one completion each', () => {
    // Wed 2026-08-05, Thu 2026-07-30 (prior week), Mon 2026-07-20 (two weeks prior)
    const dates = ['2026-08-05T10:00:00Z', '2026-07-30T09:00:00Z', '2026-07-20T08:00:00Z']
    expect(computeStreakWeeks(dates)).toBe(3)
  })

  it('stops counting at the first gap week', () => {
    // latest week, then a gap, then an older week — streak should stop at the gap
    const dates = ['2026-08-05T10:00:00Z', '2026-07-15T08:00:00Z']
    expect(computeStreakWeeks(dates)).toBe(1)
  })

  it('ignores multiple completions in the same week beyond the first', () => {
    const dates = ['2026-08-03T08:00:00Z', '2026-08-05T10:00:00Z']
    expect(computeStreakWeeks(dates)).toBe(1)
  })
})

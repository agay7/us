import { describe, it, expect } from 'vitest'
import { computeLeaderboard } from './points'

describe('computeLeaderboard', () => {
  it('sums points per user across multiple completions', () => {
    const totals = computeLeaderboard([
      { userId: 'a', points: 15 },
      { userId: 'b', points: 30 },
      { userId: 'a', points: 10 },
    ])
    expect(totals).toEqual({ a: 25, b: 30 })
  })

  it('returns an empty object for no completions', () => {
    expect(computeLeaderboard([])).toEqual({})
  })
})

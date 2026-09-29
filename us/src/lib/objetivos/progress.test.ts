import { describe, it, expect } from 'vitest'
import { savingsProgress, milestoneProgress } from './progress'

describe('savingsProgress', () => {
  it('rounds the percentage toward the target', () => {
    expect(savingsProgress(1860, 3000)).toBe(62)
  })

  it('caps at 100% when contributions exceed the target', () => {
    expect(savingsProgress(3500, 3000)).toBe(100)
  })

  it('returns 0 for a zero or negative target instead of dividing by zero', () => {
    expect(savingsProgress(100, 0)).toBe(0)
  })
})

describe('milestoneProgress', () => {
  it('computes the completed percentage', () => {
    expect(milestoneProgress(2, 5)).toBe(40)
  })

  it('returns 0 for a goal with no milestones yet', () => {
    expect(milestoneProgress(0, 0)).toBe(0)
  })

  it('returns 100 when every milestone is completed', () => {
    expect(milestoneProgress(3, 3)).toBe(100)
  })
})

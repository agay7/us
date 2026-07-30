import { describe, it, expect } from 'vitest'
import { getMarkerCategory } from './markerCategory'

const ME = 'user-me'
const PARTNER = 'user-partner'

describe('getMarkerCategory', () => {
  it('returns "together" when a single visit has both participants', () => {
    expect(getMarkerCategory([[ME, PARTNER]], ME)).toBe('together')
  })

  it('returns "me" when the only participant across all visits is the current user', () => {
    expect(getMarkerCategory([[ME]], ME)).toBe('me')
  })

  it('returns "partner" when the only participant across all visits is someone else', () => {
    expect(getMarkerCategory([[PARTNER]], ME)).toBe('partner')
  })

  it('returns "together" when the place has separate solo visits by each person', () => {
    expect(getMarkerCategory([[ME], [PARTNER]], ME)).toBe('together')
  })

  it('returns "me" when the current user visited the same place solo more than once', () => {
    expect(getMarkerCategory([[ME], [ME]], ME)).toBe('me')
  })
})

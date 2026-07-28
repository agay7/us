import { describe, it, expect } from 'vitest'
import { ZONES, zoneLabel } from './zones'

describe('ZONES', () => {
  it('has exactly spain, europe and world in that order', () => {
    expect(ZONES.map((z) => z.value)).toEqual(['spain', 'europe', 'world'])
  })
})

describe('zoneLabel', () => {
  it('formats each zone with its icon and Spanish label', () => {
    expect(zoneLabel('spain')).toBe('🇪🇸 España')
    expect(zoneLabel('europe')).toBe('🇪🇺 Europa')
    expect(zoneLabel('world')).toBe('🌍 Mundo')
  })
})

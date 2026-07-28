import { describe, it, expect } from 'vitest'
import { mergeWishlists, type WishlistEntry } from './wishlistMerge'

describe('mergeWishlists', () => {
  it('marks a place as mutual when both members have it, and lists both names', () => {
    const entries: WishlistEntry[] = [
      { placeId: 'japan', placeName: 'Japón', zone: 'world', userId: 'a', displayName: 'Alberto', rank: 1 },
      { placeId: 'japan', placeName: 'Japón', zone: 'world', userId: 'b', displayName: 'Marta', rank: 1 },
    ]
    const [result] = mergeWishlists(entries)
    expect(result.isMutual).toBe(true)
    expect(result.topForLabel).toBe('Top de Alberto y de Marta')
  })

  it('sorts mutual places before non-mutual ones regardless of rank', () => {
    const entries: WishlistEntry[] = [
      { placeId: 'norway', placeName: 'Noruega', zone: 'europe', userId: 'b', displayName: 'Marta', rank: 1 },
      { placeId: 'japan', placeName: 'Japón', zone: 'world', userId: 'a', displayName: 'Alberto', rank: 3 },
      { placeId: 'japan', placeName: 'Japón', zone: 'world', userId: 'b', displayName: 'Marta', rank: 3 },
    ]
    const result = mergeWishlists(entries)
    expect(result.map((r) => r.placeId)).toEqual(['japan', 'norway'])
  })

  it('sorts non-mutual places by best rank ascending', () => {
    const entries: WishlistEntry[] = [
      { placeId: 'asturias', placeName: 'Asturias', zone: 'spain', userId: 'a', displayName: 'Alberto', rank: 3 },
      { placeId: 'norway', placeName: 'Noruega', zone: 'europe', userId: 'b', displayName: 'Marta', rank: 2 },
    ]
    const result = mergeWishlists(entries)
    expect(result.map((r) => r.placeId)).toEqual(['norway', 'asturias'])
    expect(result[0].topForLabel).toBe('Top de Marta')
  })
})

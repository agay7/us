import type { Zone } from './zones'

export type WishlistEntry = {
  placeId: string
  placeName: string
  zone: Zone
  userId: string
  displayName: string
  rank: number
}

export type MergedWishlistItem = {
  placeId: string
  placeName: string
  zone: Zone
  isMutual: boolean
  bestRank: number
  topForLabel: string
}

export function mergeWishlists(entries: WishlistEntry[]): MergedWishlistItem[] {
  const byPlace = new Map<string, WishlistEntry[]>()
  for (const entry of entries) {
    const list = byPlace.get(entry.placeId) ?? []
    list.push(entry)
    byPlace.set(entry.placeId, list)
  }

  const merged: MergedWishlistItem[] = Array.from(byPlace.values()).map((list) => {
    const uniqueUserIds = new Set(list.map((e) => e.userId))
    const isMutual = uniqueUserIds.size >= 2
    const bestRank = Math.min(...list.map((e) => e.rank))
    const names = list.map((e) => e.displayName)
    const topForLabel =
      names.length >= 2
        ? `Top de ${names.slice(0, -1).join(', ')} y de ${names[names.length - 1]}`
        : `Top de ${names[0]}`

    return {
      placeId: list[0].placeId,
      placeName: list[0].placeName,
      zone: list[0].zone,
      isMutual,
      bestRank,
      topForLabel,
    }
  })

  merged.sort((a, b) => {
    if (a.isMutual !== b.isMutual) return a.isMutual ? -1 : 1
    return a.bestRank - b.bestRank
  })

  return merged
}

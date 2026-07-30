export type GeocodeResult = { lat: number; lng: number } | null

// Free geocoding via OpenStreetMap Nominatim — no API key, no cost, fits
// this project's zero-budget constraint. Failures (no match, offline,
// rate limit) resolve to null rather than throwing, so a failed lookup
// never blocks adding a visit — it just won't get a map pin.
export async function geocodePlace(query: string): Promise<GeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url)
    if (!res.ok) return null

    const results = (await res.json()) as { lat: string; lon: string }[]
    if (!Array.isArray(results) || results.length === 0) return null

    const { lat, lon } = results[0]
    return { lat: parseFloat(lat), lng: parseFloat(lon) }
  } catch {
    return null
  }
}

import { describe, it, expect, vi, afterEach } from 'vitest'
import { geocodePlace } from './geocode'

describe('geocodePlace', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns lat/lng from the first result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ lat: '41.9028', lon: '12.4964' }],
      })
    )

    const result = await geocodePlace('Roma, Italia')
    expect(result).toEqual({ lat: 41.9028, lng: 12.4964 })
  })

  it('returns null when there are no results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    )

    const result = await geocodePlace('asdkjfhaskdjfh')
    expect(result).toBeNull()
  })

  it('returns null when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false })
    )

    const result = await geocodePlace('Roma')
    expect(result).toBeNull()
  })

  it('returns null when fetch throws (e.g. offline)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error'))
    )

    const result = await geocodePlace('Roma')
    expect(result).toBeNull()
  })
})

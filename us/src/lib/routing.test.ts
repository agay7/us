import { describe, it, expect } from 'vitest'
import { getPostAuthRedirect } from './routing'

describe('getPostAuthRedirect', () => {
  it('sends members with a space to /inicio', () => {
    expect(getPostAuthRedirect(true)).toBe('/inicio')
  })

  it('sends members without a space to /welcome', () => {
    expect(getPostAuthRedirect(false)).toBe('/welcome')
  })
})

import { describe, it, expect } from 'vitest'
import { generateInviteCode, isValidInviteCodeFormat, INVITE_CODE_ALPHABET } from './inviteCode'

describe('generateInviteCode', () => {
  it('generates an 8-character code using only the allowed alphabet', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(8)
    expect(code).toMatch(new RegExp(`^[${INVITE_CODE_ALPHABET}]{8}$`))
  })

  it('is deterministic when given a fixed random source', () => {
    let calls = 0
    const fixedRandom = () => {
      calls += 1
      return 0
    }
    const code = generateInviteCode(fixedRandom)
    expect(code).toBe(INVITE_CODE_ALPHABET[0].repeat(8))
    expect(calls).toBe(8)
  })
})

describe('isValidInviteCodeFormat', () => {
  it('accepts a well-formed code', () => {
    expect(isValidInviteCodeFormat('ABCDEFGH')).toBe(true)
  })

  it('rejects codes with the wrong length', () => {
    expect(isValidInviteCodeFormat('ABC')).toBe(false)
  })

  it('rejects lowercase input', () => {
    expect(isValidInviteCodeFormat('abcdefgh')).toBe(false)
  })

  it('rejects ambiguous characters like O, 0, I, 1', () => {
    expect(isValidInviteCodeFormat('O0I1O0I1')).toBe(false)
  })
})

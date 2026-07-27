export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin O/0/I/1

export function generateInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += INVITE_CODE_ALPHABET[Math.floor(random() * INVITE_CODE_ALPHABET.length)]
  }
  return code
}

export function isValidInviteCodeFormat(code: string): boolean {
  return new RegExp(`^[${INVITE_CODE_ALPHABET}]{8}$`).test(code)
}

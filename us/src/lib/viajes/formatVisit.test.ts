import { describe, it, expect } from 'vitest'
import { formatVisitSummary } from './formatVisit'

describe('formatVisitSummary', () => {
  it('shows "Juntos" when there are two participants', () => {
    const result = formatVisitSummary(
      [
        { userId: 'a', displayName: 'Alberto' },
        { userId: 'b', displayName: 'Marta' },
      ],
      '2025-03-01'
    )
    expect(result).toBe('👫 Juntos · Marzo de 2025')
  })

  it('shows the solo participant\'s name when there is only one', () => {
    const result = formatVisitSummary([{ userId: 'b', displayName: 'Marta' }], '2019-06-01')
    expect(result).toBe('🧍 Marta en solitario · Junio de 2019')
  })

  it('shows "fecha desconocida" when the visit has no date', () => {
    const result = formatVisitSummary([{ userId: 'b', displayName: 'Marta' }], null)
    expect(result).toBe('🧍 Marta en solitario · Fecha desconocida')
  })
})

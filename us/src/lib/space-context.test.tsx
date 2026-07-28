// src/lib/space-context.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpaceProvider, useSpaceId } from './space-context'

function Consumer() {
  const spaceId = useSpaceId()
  return <p>space: {spaceId}</p>
}

describe('useSpaceId', () => {
  it('returns the spaceId provided by SpaceProvider', () => {
    render(
      <SpaceProvider spaceId="abc-123">
        <Consumer />
      </SpaceProvider>
    )
    expect(screen.getByText('space: abc-123')).toBeInTheDocument()
  })

  it('throws when used outside a SpaceProvider', () => {
    const consoleError = console.error
    console.error = () => {} // suppress React's expected error boundary log
    expect(() => render(<Consumer />)).toThrow(/useSpaceId must be used within a SpaceProvider/)
    console.error = consoleError
  })
})

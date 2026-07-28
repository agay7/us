// src/lib/space-context.tsx
'use client'

import { createContext, useContext, type ReactNode } from 'react'

const SpaceContext = createContext<string | null>(null)

export function SpaceProvider({
  spaceId,
  children,
}: {
  spaceId: string
  children: ReactNode
}) {
  return <SpaceContext.Provider value={spaceId}>{children}</SpaceContext.Provider>
}

export function useSpaceId(): string {
  const spaceId = useContext(SpaceContext)
  if (!spaceId) {
    throw new Error('useSpaceId must be used within a SpaceProvider')
  }
  return spaceId
}

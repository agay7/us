// src/app/(app)/viajes/page.tsx
'use client'

import { useState } from 'react'
import { useSpaceId } from '@/lib/space-context'
import { ZONES, type Zone } from '@/lib/viajes/zones'
import VisitadosTab from './VisitadosTab'
import PendientesTab from './PendientesTab'

type Tab = 'visitados' | 'pendientes'

export default function ViajesPage() {
  const spaceId = useSpaceId()
  const [tab, setTab] = useState<Tab>('visitados')
  const [zone, setZone] = useState<Zone | 'all'>('all')

  return (
    <main className="pb-4">
      <div className="flex border-b text-sm">
        <button
          onClick={() => setTab('visitados')}
          className={`flex-1 py-2 text-center ${
            tab === 'visitados' ? 'border-b-2 border-blue-600 font-bold' : 'opacity-60'
          }`}
        >
          Visitados
        </button>
        <button
          onClick={() => setTab('pendientes')}
          className={`flex-1 py-2 text-center ${
            tab === 'pendientes' ? 'border-b-2 border-blue-600 font-bold' : 'opacity-60'
          }`}
        >
          Pendientes
        </button>
      </div>

      <div className="flex gap-2 p-3 text-xs">
        <button
          onClick={() => setZone('all')}
          className={`rounded-full border px-3 py-1 ${zone === 'all' ? '' : 'opacity-50'}`}
        >
          Todas
        </button>
        {ZONES.map((z) => (
          <button
            key={z.value}
            onClick={() => setZone(z.value)}
            className={`rounded-full border px-3 py-1 ${zone === z.value ? '' : 'opacity-50'}`}
          >
            {z.icon} {z.label}
          </button>
        ))}
      </div>

      {tab === 'visitados' && <VisitadosTab spaceId={spaceId} zone={zone} />}

      {tab === 'pendientes' && <PendientesTab spaceId={spaceId} zone={zone} />}
    </main>
  )
}

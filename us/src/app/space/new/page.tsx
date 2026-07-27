'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateInviteCode } from '@/lib/inviteCode'

export default function NewSpacePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const code = generateInviteCode()
    const supabase = createClient()
    const { error } = await supabase.rpc('create_space', {
      p_name: name,
      p_invite_code: code,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setInviteCode(code)
  }

  if (inviteCode) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">¡Space creado!</h1>
        <p>Comparte este código con tu pareja para que se una:</p>
        <p className="rounded bg-gray-100 p-4 text-3xl font-mono tracking-widest">
          {inviteCode}
        </p>
        <button
          onClick={() => router.push('/inicio')}
          className="rounded bg-blue-600 py-2 text-white"
        >
          Continuar
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Crea tu space</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          placeholder='Ej. "Alberto & Marta"'
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear'}
        </button>
      </form>
    </main>
  )
}

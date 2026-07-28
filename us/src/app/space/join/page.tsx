'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isValidInviteCodeFormat } from '@/lib/inviteCode'

export default function JoinSpacePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const normalized = code.trim().toUpperCase()
    if (!isValidInviteCodeFormat(normalized)) {
      setError('Ese código no tiene el formato correcto (8 caracteres).')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('join_space_by_invite_code', {
      p_invite_code: normalized,
    })
    setLoading(false)

    if (error) {
      setError(
        error.message === 'invalid_invite_code'
          ? 'Ese código no corresponde a ningún space.'
          : error.message === 'space_full'
            ? 'Ese space ya tiene dos miembros.'
            : error.message === 'already_in_space'
              ? 'Ya perteneces a un space.'
              : error.message
      )
      return
    }

    router.push('/inicio')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Únete a un space</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          placeholder="Código de invitación"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border px-3 py-2 text-center font-mono uppercase tracking-widest"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Uniéndote...' : 'Unirme'}
        </button>
      </form>
    </main>
  )
}

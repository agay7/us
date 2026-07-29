'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PerfilPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()

      setName(data?.display_name ?? '')
      setSavedName(data?.display_name ?? '')
      setLoading(false)
    }

    loadProfile()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase.rpc('update_display_name', { p_display_name: name })

    setSaving(false)

    if (error) {
      setError(
        error.message === 'invalid_display_name'
          ? 'El nombre no puede estar vacío.'
          : error.message
      )
      return
    }

    setSavedName(name)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Perfil</h1>

      {!loading && (
        <form onSubmit={handleSave} className="mt-4 flex max-w-xs flex-col gap-3">
          <label htmlFor="display-name" className="text-sm">
            Tu nombre
          </label>
          <input
            id="display-name"
            required
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || name === savedName}
            className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar nombre'}
          </button>
        </form>
      )}

      <button
        onClick={handleLogout}
        className="mt-6 rounded bg-gray-200 px-4 py-2 text-sm text-gray-900"
      >
        Cerrar sesión
      </button>
    </main>
  )
}

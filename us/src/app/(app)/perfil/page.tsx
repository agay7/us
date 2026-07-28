'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PerfilPage() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Perfil</h1>
      <button
        onClick={handleLogout}
        className="mt-4 rounded bg-gray-200 px-4 py-2 text-sm text-gray-900"
      >
        Cerrar sesión
      </button>
    </main>
  )
}

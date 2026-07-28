import { redirect } from 'next/navigation'
import { getSessionAndMembership } from '@/lib/session'

export default async function WelcomePage() {
  const { user, spaceId } = await getSessionAndMembership()

  if (!user) {
    redirect('/login')
  }

  if (spaceId) {
    redirect('/inicio')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">¡Bienvenido a Us!</h1>
      <p className="text-gray-600">¿Empiezas un space nuevo o te unes a uno existente?</p>
      <a href="/space/new" className="rounded bg-blue-600 py-2 text-white">
        Crear un space
      </a>
      <a href="/space/join" className="rounded border border-blue-600 py-2 text-blue-600">
        Unirme con un código
      </a>
    </main>
  )
}

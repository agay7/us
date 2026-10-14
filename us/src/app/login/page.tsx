'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'forgot' | 'recovery'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Clicking the "reset password" link from an email lands back here with a
  // recovery token in the URL; the Supabase client parses it on load and
  // fires this event instead of giving us a normal session.
  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/')
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setForgotSent(true)
  }

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/')
  }

  if (mode === 'recovery') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Elige tu nueva contraseña</h1>
        <form onSubmit={handleRecoverySubmit} className="flex flex-col gap-3">
          <label htmlFor="new-password" className="sr-only">
            Contraseña nueva
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Contraseña nueva (mín. 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded border px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </main>
    )
  }

  if (mode === 'forgot') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
        {forgotSent ? (
          <p className="text-sm text-gray-600">
            Si ese email tiene una cuenta, te hemos enviado un enlace para elegir una contraseña nueva.
          </p>
        ) : (
          <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3">
            <label htmlFor="forgot-email" className="sr-only">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border px-3 py-2"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => {
            setMode('login')
            setError(null)
            setForgotSent(false)
          }}
          className="text-center text-sm text-blue-600"
        >
          Volver a iniciar sesión
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Inicia sesión</h1>
      <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <label htmlFor="password" className="sr-only">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <button type="button" onClick={() => setMode('forgot')} className="text-center text-sm text-blue-600">
        ¿Olvidaste tu contraseña?
      </button>
      <a href="/signup" className="text-center text-sm text-blue-600">
        ¿No tienes cuenta? Regístrate
      </a>
    </main>
  )
}

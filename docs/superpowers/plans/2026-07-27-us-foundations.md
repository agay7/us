# Us — Fundamentos (Plan 1 de 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a working, authenticated web app where two people can each sign up, one creates a shared "space" and the other joins it via an invite code, and both land on a navigable app shell — the foundation the Viajes/Retos/Objetivos modules (separate plans) will be built on top of.

**Architecture:** Next.js (App Router, TypeScript) frontend on Vercel; Supabase (Postgres + Auth) as the backend, accessed via `@supabase/ssr` for cookie-based SSR auth. All space data access is gated by Postgres Row Level Security keyed off a `space_members` join table (never a direct two-user-ID comparison), so the same schema will support >2-member spaces later without migration. Writes to `spaces`/`space_members` only happen through two `SECURITY DEFINER` RPC functions (`create_space`, `join_space_by_invite_code`) — there are no direct client INSERT policies on these tables.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS, Supabase (Postgres, Auth) via `@supabase/supabase-js` + `@supabase/ssr`, Vitest + React Testing Library, Vercel hosting, Supabase CLI for migrations.

## Global Constraints

- Mobile-first, responsive PWA (per spec §2-3).
- Stack is fixed: Next.js + Tailwind + Supabase, hosted on Vercel + Supabase free tier (spec §2).
- RLS policies must check space membership via `space_members`, never compare `user_id` to a fixed pair (spec §2, §4) — this is what makes the schema multi-member-ready.
- Invite codes are single-use per space, no expiry logic needed in this phase (spec §6).
- No `activity_feed` table yet, no notifications, no multi-space-per-user support, no roles beyond `owner`/`member` — all explicitly deferred to later phases (spec §8).
- User is a first-time programmer: every setup step includes exact commands and what success looks like, no assumed prior knowledge of any tool introduced.
- Node.js ≥20.6 is required (used for `--env-file` in Task 6's verification script).
- Everything lives in one git repository at the `P&C` root; the Next.js app is the `us/` subfolder, not a nested repo — Vercel's Root Directory must be set to `us`.

---

## File Structure

```
us/
├── src/
│   ├── app/
│   │   ├── layout.tsx                # root layout, imports globals.css
│   │   ├── globals.css
│   │   ├── page.tsx                  # "/" — redirect based on auth/space state
│   │   ├── manifest.ts               # PWA manifest
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── welcome/page.tsx          # choose "crear space" / "unirse"
│   │   ├── space/
│   │   │   ├── new/page.tsx
│   │   │   └── join/page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx            # requires auth + space membership, renders BottomNav
│   │       ├── inicio/page.tsx
│   │       ├── viajes/page.tsx       # placeholder, built out in Plan 2
│   │       ├── retos/page.tsx        # placeholder, built out in Plan 3
│   │       ├── objetivos/page.tsx    # placeholder, built out in Plan 4
│   │       └── perfil/page.tsx
│   ├── components/
│   │   ├── BottomNav.tsx
│   │   └── BottomNav.test.tsx
│   └── lib/
│       ├── inviteCode.ts             # pure: generateInviteCode, isValidInviteCodeFormat
│       ├── inviteCode.test.ts
│       ├── routing.ts                # pure: getPostAuthRedirect
│       ├── routing.test.ts
│       └── supabase/
│           ├── client.ts             # browser client
│           ├── server.ts             # server component client
│           └── middleware.ts         # updateSession()
├── middleware.ts                     # root, calls updateSession
├── supabase/
│   └── migrations/
│       └── 0001_core_schema.sql
├── scripts/
│   └── check-rls.mjs                 # manual RLS isolation verification
├── vitest.config.ts
├── vitest.setup.ts
└── .env.local                        # not committed
```

---

### Task 1: Crear el proyecto de Supabase

**Files:** ninguno (pasos manuales en la web de Supabase)

- [ ] **Step 1: Crear la cuenta**

Ve a `https://supabase.com`, pulsa "Start your project" y regístrate (puedes usar tu cuenta de GitHub).

- [ ] **Step 2: Crear el proyecto**

Dentro del dashboard, pulsa "New project". Ponle de nombre `us` (o `us-dev`), elige una contraseña de base de datos fuerte (guárdala en un gestor de contraseñas — la necesitarás si algún día conectas herramientas externas) y elige la región más cercana a ti (ej. `eu-west` si estás en España). Espera 1-2 minutos a que el proyecto termine de aprovisionarse.

- [ ] **Step 3: Guardar las credenciales**

En el proyecto, ve a **Project Settings → API**. Vas a necesitar dos valores más adelante en el Task 4:
- `Project URL` (algo como `https://xxxxxxxx.supabase.co`)
- `anon public` key (una cadena larga bajo "Project API keys")

Déjalos copiados en un sitio temporal — los usarás en el Task 4, no hace falta hacer nada más con ellos ahora.

- [ ] **Step 4: Instalar la CLI de Supabase**

Esta CLI es la herramienta con la que enviaremos los cambios de base de datos (migraciones) desde tu ordenador al proyecto en la nube, sin tener que escribir SQL a mano en el navegador cada vez.

Run: `npm install -g supabase`
Expected: instala sin errores; `supabase --version` imprime un número de versión.

- [ ] **Step 5: Conectar la CLI con tu proyecto**

En **Project Settings → General**, copia el "Reference ID" del proyecto (una cadena corta tipo `abcdefghijklmnop`).

Run: `supabase login`
Expected: abre el navegador para autorizar la CLI; tras aceptar, vuelve a mostrar la terminal.

Esto lo terminaremos de vincular a una carpeta de proyecto en el Task 6, cuando ya tengamos el repositorio de Next.js creado.

- [ ] **Step 6: Desactivar la confirmación por email (solo para esta fase)**

Por defecto, Supabase exige que cada usuario confirme su email antes de tener sesión activa — eso añade un paso extra (revisar el correo) que no aporta nada cuando los únicos usuarios sois vosotros dos. Ve a **Authentication → Sign In / Providers → Email** y desactiva **"Confirm email"**. Guarda los cambios.

(Cuando en el futuro esta app acepte usuarios que no conoces personalmente — Fase 3 de la spec — este es exactamente el tipo de ajuste que habría que revertir.)

---

### Task 2: Scaffold del proyecto Next.js

**Files:**
- Create: todo el árbol generado por `create-next-app` dentro de `us/`

- [ ] **Step 0: Comprobar que tienes Node.js instalado (versión 20.6 o superior)**

Run: `node --version`
Expected: imprime `v20.6.0` o superior (necesitamos ≥20.6 para el flag `--env-file` que usaremos en el Task 6). Si no tienes Node instalado o tienes una versión menor, descárgalo de `https://nodejs.org` (la versión "LTS"), instálalo, cierra y vuelve a abrir la terminal, y repite este comando.

- [ ] **Step 1: Generar el proyecto**

Desde la carpeta `c:\Users\34669\Desktop\Git\P&C`, ejecuta:

Run: `npx create-next-app@latest us --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack`
Expected: termina con "Success! Created us at ...". Si pregunta algo por consola, acepta las opciones por defecto.

- [ ] **Step 1b: Evitar un repositorio git anidado**

`create-next-app` inicializa su propio repositorio git dentro de `us/` si detecta que puede. Como `P&C` ya es un repositorio git (creado durante el diseño) y queremos un único repositorio que cubra tanto `docs/` como `us/`, comprueba si se creó uno anidado y bórralo:

Run: `ls -la us/.git 2>/dev/null && rm -rf us/.git || echo "no había .git anidado, perfecto"`
Expected: o bien borra `us/.git`, o imprime "no había .git anidado, perfecto" — cualquiera de los dos resultados es correcto, lo importante es que después de este paso solo exista `P&C/.git`, no `P&C/us/.git`.

- [ ] **Step 2: Verificar que arranca**

Run: `cd us && npm run dev`
Expected: en la terminal aparece `Local: http://localhost:3000`. Abre esa URL en el navegador y confirma que ves la página de bienvenida de Next.js. Detén el servidor con `Ctrl+C`.

- [ ] **Step 3: Commit**

```bash
cd us
git add .
git commit -m "chore: scaffold Next.js project with TypeScript and Tailwind"
```

---

### Task 3: Configurar Vitest y React Testing Library

**Files:**
- Create: `us/vitest.config.ts`
- Create: `us/vitest.setup.ts`
- Create: `us/src/lib/sanity.test.ts`
- Modify: `us/package.json` (añadir dependencias y script `test`)

**Interfaces:**
- Produces: `npm test` como comando para correr toda la suite en el resto de tareas.

- [ ] **Step 1: Instalar dependencias**

Run: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
Expected: instala sin errores.

- [ ] **Step 2: Crear la configuración**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Añadir el script de test**

En `package.json`, dentro de `"scripts"`, añade:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escribir un test trivial para confirmar que todo funciona**

```ts
// src/lib/sanity.test.ts
import { describe, it, expect } from 'vitest'

describe('sanity check', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Ejecutar y confirmar**

Run: `npm test`
Expected: `1 passed`, sin errores.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts src/lib/sanity.test.ts package.json package-lock.json
git commit -m "chore: set up Vitest and React Testing Library"
```

---

### Task 4: Cliente de Supabase (browser, server, middleware)

**Files:**
- Create: `us/src/lib/supabase/client.ts`
- Create: `us/src/lib/supabase/server.ts`
- Create: `us/src/lib/supabase/middleware.ts`
- Create: `us/middleware.ts`
- Create: `us/.env.local` (no se commitea)
- Modify: `us/.gitignore` (confirmar que incluye `.env*.local`, ya lo hace por defecto en create-next-app)

**Interfaces:**
- Produces: `createClient()` (browser, en `lib/supabase/client.ts`) y `createClient()` (server, async, en `lib/supabase/server.ts`) — usados por todas las páginas de los Tasks 7-11.
- Produces: `updateSession(request: NextRequest): Promise<NextResponse>` — usado por `middleware.ts`.

- [ ] **Step 1: Instalar dependencias**

Run: `npm install @supabase/supabase-js @supabase/ssr`
Expected: instala sin errores.

- [ ] **Step 2: Variables de entorno**

Crea `us/.env.local` con los dos valores del Task 1 (Project URL y anon key):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

Confirma que `us/.gitignore` contiene una línea `.env*.local` (viene por defecto al usar `create-next-app`) — así esta clave nunca se sube al repositorio.

- [ ] **Step 3: Cliente de navegador**

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Cliente de servidor**

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Se llama desde un Server Component; el middleware refresca la sesión.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 5: Middleware de sesión**

```ts
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 6: Middleware raíz**

```ts
// middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 7: Verificar que el proyecto sigue compilando**

Run: `npm run build`
Expected: termina con "Compiled successfully", sin errores de tipos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase middleware.ts .gitignore package.json package-lock.json
git commit -m "feat: add Supabase browser/server clients and session middleware"
```

(`.env.local` no se añade — ya está ignorado.)

---

### Task 5: Subir a GitHub y desplegar el esqueleto en Vercel

**Files:** ninguno de código (configuración de hosting)

- [ ] **Step 1: Crear el repositorio en GitHub**

Ve a `https://github.com/new`, crea un repositorio (puede ser privado) llamado `us`. No inicialices con README (ya tienes el proyecto localmente).

- [ ] **Step 2: Subir el código**

```bash
git remote add origin https://github.com/TU_USUARIO/us.git
git branch -M main
git push -u origin main
```

Expected: el push termina sin errores; al recargar la página del repositorio en GitHub, ves los archivos del proyecto.

- [ ] **Step 3: Conectar Vercel**

Ve a `https://vercel.com`, regístrate con tu cuenta de GitHub, pulsa "Add New… → Project" y selecciona el repositorio `us`.

- [ ] **Step 3b: Indicar la carpeta raíz del proyecto**

El código de Next.js vive en la subcarpeta `us/` del repositorio (junto a `docs/`), no en la raíz. En la pantalla de configuración del import, despliega **"Root Directory"** y escribe `us`, luego pulsa "Continue"/"Edit". Sin este paso, Vercel no encontrará el `package.json` y el build fallará.

- [ ] **Step 4: Añadir las variables de entorno en Vercel**

Antes de pulsar "Deploy", en la sección "Environment Variables" añade las mismas dos claves de tu `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- [ ] **Step 5: Desplegar**

Pulsa "Deploy". Expected: tras 1-2 minutos, Vercel muestra "Congratulations!" con una captura de tu web y una URL tipo `https://us-xxxx.vercel.app`. Ábrela y confirma que ves la misma página de bienvenida que en local.

Cada `git push` a `main` a partir de ahora despliega automáticamente una nueva versión — no hace falta repetir este paso.

---

### Task 6: Esquema núcleo en Supabase (spaces, space_members, RLS)

**Files:**
- Create: `us/supabase/migrations/0001_core_schema.sql`
- Create: `us/scripts/check-rls.mjs`

**Interfaces:**
- Produces: tablas `public.spaces`, `public.space_members`; funciones RPC `create_space(p_name text, p_invite_code text) returns uuid` y `join_space_by_invite_code(p_invite_code text) returns uuid` — usadas por los Tasks 8 y 9.

- [ ] **Step 1: Vincular la CLI a este proyecto**

Run: `supabase init`
Expected: crea la carpeta `supabase/` con un `config.toml` (puede que ya exista `supabase/migrations` del File Structure; está bien, la CLI la reutiliza).

Run: `supabase link --project-ref TU_REFERENCE_ID` (el que copiaste en el Task 1, Step 5)
Expected: pide la contraseña de la base de datos (la que guardaste al crear el proyecto) y termina con "Finished supabase link".

- [ ] **Step 2: Escribir la migración**

```sql
-- supabase/migrations/0001_core_schema.sql

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'couple' check (type in ('couple', 'group')),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

-- Comprueba pertenencia sin volver a disparar RLS sobre space_members
-- (evita recursión infinita en las políticas de abajo).
create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = target_space_id and user_id = auth.uid()
  );
$$;

create policy "members can read their space"
  on public.spaces for select
  using (public.is_space_member(id));

create policy "members can read their space_members"
  on public.space_members for select
  using (public.is_space_member(space_id));

-- No hay políticas de INSERT/UPDATE/DELETE directas: toda escritura pasa
-- por las funciones de abajo, que son las únicas con permiso de ejecución.

create or replace function public.create_space(p_name text, p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  insert into public.spaces (name, invite_code)
  values (p_name, p_invite_code)
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'owner');

  return v_space_id;
end;
$$;

create or replace function public.join_space_by_invite_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select id into v_space_id from public.spaces where invite_code = p_invite_code;

  if v_space_id is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'member')
  on conflict (space_id, user_id) do nothing;

  return v_space_id;
end;
$$;

grant execute on function public.create_space(text, text) to authenticated;
grant execute on function public.join_space_by_invite_code(text) to authenticated;
```

- [ ] **Step 2b: Aplicar la migración**

Run: `supabase db push`
Expected: muestra el archivo `0001_core_schema.sql` a aplicar, confirmas con `Y`, termina con "Finished supabase db push".

- [ ] **Step 3: Verificar en el dashboard**

En Supabase Studio (`Table Editor`), confirma que ves las tablas `spaces` y `space_members`. En `Database → Functions`, confirma que ves `create_space`, `join_space_by_invite_code` e `is_space_member`.

- [ ] **Step 4: Crear dos usuarios de prueba**

En **Authentication → Users → Add user**, crea dos usuarios con email/contraseña, por ejemplo `test-a@example.com` y `test-b@example.com` (contraseña cualquiera que recuerdes, ej. `Test1234!`). Los usaremos solo para verificar el aislamiento de datos, no son cuentas reales.

- [ ] **Step 5: Script de verificación de aislamiento (RLS)**

```js
// scripts/check-rls.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function signIn(email, password) {
  const client = createClient(url, anonKey)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

const clientA = await signIn('test-a@example.com', 'Test1234!')
const clientB = await signIn('test-b@example.com', 'Test1234!')

const { data: spaceId, error: createError } = await clientA.rpc('create_space', {
  p_name: 'Space de prueba',
  p_invite_code: 'TESTCODE',
})
if (createError) throw createError
console.log('A creó el space:', spaceId)

const { data: bBefore } = await clientB.from('spaces').select('*')
console.log('B ve (antes de unirse), debería ser []:', bBefore)

const { data: joinedId, error: joinError } = await clientB.rpc('join_space_by_invite_code', {
  p_invite_code: 'TESTCODE',
})
if (joinError) throw joinError
console.log('B se unió al space:', joinedId)

const { data: bAfter } = await clientB.from('spaces').select('*')
console.log('B ve (después de unirse), debería tener 1 fila:', bAfter)
```

- [ ] **Step 6: Ejecutar y comprobar el resultado**

Run: `node --env-file=.env.local scripts/check-rls.mjs`
Expected: la salida muestra `B ve (antes de unirse), debería ser []: []` y luego `B ve (después de unirse), debería tener 1 fila:` con un array de 1 elemento. Si en el "antes" ya aparece una fila, hay un fallo de RLS — revisa que las políticas de `select` estén activas y usen `is_space_member`.

- [ ] **Step 7: Borrar los datos de prueba**

En Supabase Studio, borra la fila `Space de prueba` de la tabla `spaces` (el borrado en cascada limpia también `space_members`), y borra los dos usuarios de prueba en **Authentication → Users**.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations scripts/check-rls.mjs
git commit -m "feat: add core spaces schema with RLS and space RPC functions"
```

---

### Task 7: Páginas de autenticación (registro y login)

**Files:**
- Create: `us/src/app/signup/page.tsx`
- Create: `us/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `createClient()` desde `@/lib/supabase/client`.

- [ ] **Step 1: Página de registro**

```tsx
// src/app/signup/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/welcome')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Contraseña (mín. 6 caracteres)"
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
          {loading ? 'Creando...' : 'Registrarme'}
        </button>
      </form>
      <a href="/login" className="text-center text-sm text-blue-600">
        ¿Ya tienes cuenta? Inicia sesión
      </a>
    </main>
  )
}
```

- [ ] **Step 2: Página de login**

```tsx
// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Inicia sesión</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          required
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
      <a href="/signup" className="text-center text-sm text-blue-600">
        ¿No tienes cuenta? Regístrate
      </a>
    </main>
  )
}
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`
Expected: en `http://localhost:3000/signup`, registra un usuario de verdad con tu email. Deberías acabar redirigido a `/welcome` (dará 404 hasta el Task 8 — es esperado, confirma solo que la redirección ocurre). En Supabase Studio → Authentication → Users, confirma que el usuario aparece.

Repite en una ventana de incógnito con `/login` usando esas mismas credenciales y confirma que entra sin error.

- [ ] **Step 4: Commit**

```bash
git add src/app/signup src/app/login
git commit -m "feat: add signup and login pages"
```

---

### Task 8: Crear un space

**Files:**
- Create: `us/src/lib/inviteCode.ts`
- Create: `us/src/lib/inviteCode.test.ts`
- Create: `us/src/app/space/new/page.tsx`

**Interfaces:**
- Produces: `generateInviteCode(): string`, `isValidInviteCodeFormat(code: string): boolean` — reutilizadas en el Task 9.
- Consumes: RPC `create_space` del Task 6.

- [ ] **Step 1: Escribir el test de la función de código de invitación**

```ts
// src/lib/inviteCode.test.ts
import { describe, it, expect } from 'vitest'
import { generateInviteCode, isValidInviteCodeFormat, INVITE_CODE_ALPHABET } from './inviteCode'

describe('generateInviteCode', () => {
  it('generates an 8-character code using only the allowed alphabet', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(8)
    expect(code).toMatch(new RegExp(`^[${INVITE_CODE_ALPHABET}]{8}$`))
  })

  it('is deterministic when given a fixed random source', () => {
    let calls = 0
    const fixedRandom = () => {
      calls += 1
      return 0
    }
    const code = generateInviteCode(fixedRandom)
    expect(code).toBe(INVITE_CODE_ALPHABET[0].repeat(8))
    expect(calls).toBe(8)
  })
})

describe('isValidInviteCodeFormat', () => {
  it('accepts a well-formed code', () => {
    expect(isValidInviteCodeFormat('ABCDEFGH')).toBe(true)
  })

  it('rejects codes with the wrong length', () => {
    expect(isValidInviteCodeFormat('ABC')).toBe(false)
  })

  it('rejects lowercase input', () => {
    expect(isValidInviteCodeFormat('abcdefgh')).toBe(false)
  })

  it('rejects ambiguous characters like O, 0, I, 1', () => {
    expect(isValidInviteCodeFormat('O0I1O0I1')).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './inviteCode'`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/inviteCode.ts
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin O/0/I/1

export function generateInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += INVITE_CODE_ALPHABET[Math.floor(random() * INVITE_CODE_ALPHABET.length)]
  }
  return code
}

export function isValidInviteCodeFormat(code: string): boolean {
  return new RegExp(`^[${INVITE_CODE_ALPHABET}]{8}$`).test(code)
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test`
Expected: todos los tests en verde, incluidos los 6 de `inviteCode.test.ts`.

- [ ] **Step 5: Página "crear space"**

```tsx
// src/app/space/new/page.tsx
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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/inviteCode.ts src/lib/inviteCode.test.ts src/app/space/new
git commit -m "feat: add invite code generation and space creation page"
```

---

### Task 9: Unirse a un space mediante código

**Files:**
- Create: `us/src/app/space/join/page.tsx`

**Interfaces:**
- Consumes: `isValidInviteCodeFormat` (Task 8), RPC `join_space_by_invite_code` (Task 6).

- [ ] **Step 1: Página "unirse a un space"**

```tsx
// src/app/space/join/page.tsx
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
```

- [ ] **Step 2: Verificación manual end-to-end**

Run: `npm run dev`
Expected: con tu usuario ya logueado, ve a `/space/new`, crea un space y anota el código mostrado. Cierra sesión, regístrate con un segundo email (o usa una ventana de incógnito), ve a `/space/join`, introduce el código y confirma que redirige a `/inicio` (dará 404 hasta el Task 10 — esperado).

- [ ] **Step 3: Commit**

```bash
git add src/app/space/join
git commit -m "feat: add join-space-by-invite-code page"
```

---

### Task 10: App shell — barra de navegación inferior y páginas placeholder

**Files:**
- Create: `us/src/lib/routing.ts`
- Create: `us/src/lib/routing.test.ts`
- Create: `us/src/components/BottomNav.tsx`
- Create: `us/src/components/BottomNav.test.tsx`
- Create: `us/src/app/(app)/layout.tsx`
- Create: `us/src/app/(app)/inicio/page.tsx`
- Create: `us/src/app/(app)/viajes/page.tsx`
- Create: `us/src/app/(app)/retos/page.tsx`
- Create: `us/src/app/(app)/objetivos/page.tsx`
- Create: `us/src/app/(app)/perfil/page.tsx`
- Create: `us/src/app/welcome/page.tsx`

**Interfaces:**
- Produces: `getPostAuthRedirect(hasSpace: boolean): '/inicio' | '/welcome'` — usado también por el Task 11.
- Produces: `<BottomNav />` — componente sin props, se auto-posiciona vía `usePathname()`.

- [ ] **Step 1: Test de la función de redirección**

```ts
// src/lib/routing.test.ts
import { describe, it, expect } from 'vitest'
import { getPostAuthRedirect } from './routing'

describe('getPostAuthRedirect', () => {
  it('sends members with a space to /inicio', () => {
    expect(getPostAuthRedirect(true)).toBe('/inicio')
  })

  it('sends members without a space to /welcome', () => {
    expect(getPostAuthRedirect(false)).toBe('/welcome')
  })
})
```

- [ ] **Step 2: Confirmar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './routing'`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/routing.ts
export function getPostAuthRedirect(hasSpace: boolean): '/inicio' | '/welcome' {
  return hasSpace ? '/inicio' : '/welcome'
}
```

- [ ] **Step 4: Confirmar que pasa**

Run: `npm test`
Expected: todos los tests en verde.

- [ ] **Step 5: Test de BottomNav**

```tsx
// src/components/BottomNav.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BottomNav from './BottomNav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/viajes',
}))

describe('BottomNav', () => {
  it('marks the current section as active', () => {
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: /viajes/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /inicio/i })).not.toHaveAttribute('aria-current')
  })

  it('renders all five sections', () => {
    render(<BottomNav />)
    ;['Inicio', 'Viajes', 'Retos', 'Objetivos', 'Perfil'].forEach((label) => {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 6: Confirmar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './BottomNav'`.

- [ ] **Step 7: Implementar BottomNav**

```tsx
// src/components/BottomNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/inicio', label: 'Inicio', icon: '🏠' },
  { href: '/viajes', label: 'Viajes', icon: '✈️' },
  { href: '/retos', label: 'Retos', icon: '🏆' },
  { href: '/objetivos', label: 'Objetivos', icon: '🎯' },
  { href: '/perfil', label: 'Perfil', icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center py-2 text-xs ${
              active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 8: Confirmar que pasa**

Run: `npm test`
Expected: todos los tests en verde.

- [ ] **Step 9: Layout protegido del grupo (app)**

```tsx
// src/app/(app)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    redirect('/welcome')
  }

  return (
    <div className="flex min-h-screen flex-col pb-16">
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 10: Páginas placeholder**

```tsx
// src/app/(app)/inicio/page.tsx
export default function InicioPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Inicio</h1>
      <p className="mt-2 text-gray-600">
        Aquí verás el resumen de Viajes, Retos y Objetivos (Plan 2-4).
      </p>
    </main>
  )
}
```

Repite el mismo patrón (título + texto descriptivo, sin lógica) para:

```tsx
// src/app/(app)/viajes/page.tsx
export default function ViajesPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Viajes</h1>
      <p className="mt-2 text-gray-600">Módulo en construcción (Plan 2).</p>
    </main>
  )
}
```

```tsx
// src/app/(app)/retos/page.tsx
export default function RetosPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Retos</h1>
      <p className="mt-2 text-gray-600">Módulo en construcción (Plan 3).</p>
    </main>
  )
}
```

```tsx
// src/app/(app)/objetivos/page.tsx
export default function ObjetivosPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Objetivos</h1>
      <p className="mt-2 text-gray-600">Módulo en construcción (Plan 4).</p>
    </main>
  )
}
```

```tsx
// src/app/(app)/perfil/page.tsx
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
        className="mt-4 rounded bg-gray-200 px-4 py-2 text-sm"
      >
        Cerrar sesión
      </button>
    </main>
  )
}
```

- [ ] **Step 11: Página de bienvenida (sin space todavía)**

```tsx
// src/app/welcome/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
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
```

- [ ] **Step 12: Ejecutar toda la suite**

Run: `npm test`
Expected: todos los tests en verde (routing, BottomNav, inviteCode, sanity).

- [ ] **Step 13: Commit**

```bash
git add src/lib/routing.ts src/lib/routing.test.ts src/components src/app/\(app\) src/app/welcome
git commit -m "feat: add app shell with bottom nav and placeholder module pages"
```

---

### Task 11: Redirección raíz según estado de sesión/space

**Files:**
- Create: `us/src/app/page.tsx`

**Interfaces:**
- Consumes: `getPostAuthRedirect` (Task 10), `createClient()` server (Task 4).

- [ ] **Step 1: Implementar la página raíz**

```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthRedirect } from '@/lib/routing'

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .maybeSingle()

  redirect(getPostAuthRedirect(!!membership))
}
```

- [ ] **Step 2: Verificación manual end-to-end completa**

Run: `npm run dev`

Recorre el flujo completo de principio a fin:
1. Visita `http://localhost:3000/` sin sesión → redirige a `/login`.
2. Regístrate con un email nuevo → termina en `/welcome`.
3. Pulsa "Crear un space", ponle un nombre → ves el código de invitación → "Continuar" te lleva a `/inicio` con la barra inferior visible.
4. Navega por las 5 secciones con la barra inferior y confirma que la sección activa se resalta.
5. En otra ventana de incógnito, regístrate con un segundo email, introduce el código del paso 3 en `/space/join` → termina también en `/inicio`.
6. Desde "Perfil", pulsa "Cerrar sesión" → vuelve a `/login`.

Expected: los 6 pasos funcionan sin errores en la consola del navegador.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add root redirect based on auth and space membership"
```

---

### Task 12: Manifest PWA y despliegue final de verificación

**Files:**
- Create: `us/src/app/manifest.ts`
- Create: `us/public/icon-192.png` (manual)
- Create: `us/public/icon-512.png` (manual)
- Modify: `us/src/app/layout.tsx` (theme-color)

**Interfaces:** ninguna (última tarea del plan).

- [ ] **Step 1: Generar los iconos**

Ve a `https://realfavicongenerator.net` (o cualquier editor de imágenes), crea un icono cuadrado simple (ej. las iniciales "U" sobre un color de fondo) y expórtalo en dos tamaños: 192x192 y 512x512 píxeles, como PNG. Guárdalos en `us/public/` con los nombres `icon-192.png` e `icon-512.png`.

- [ ] **Step 2: Manifest**

```ts
// src/app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Us',
    short_name: 'Us',
    description: 'Espacio compartido para organizar viajes, retos y objetivos en pareja',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f9dff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

- [ ] **Step 3: theme-color en el layout raíz**

En `src/app/layout.tsx`, dentro del `export const metadata`, añade:

```ts
export const metadata: Metadata = {
  // ...lo que ya haya generado create-next-app
  manifest: '/manifest.webmanifest',
  themeColor: '#4f9dff',
}
```

(Nota: la instalabilidad completa offline con service worker queda fuera de esta fase — spec §8, Fase 4. Este manifest ya permite "Añadir a pantalla de inicio" en Chrome/Android.)

- [ ] **Step 4: Verificar localmente**

Run: `npm run build && npm start`
Expected: en Chrome (móvil o DevTools → Application → Manifest), abre `http://localhost:3000/manifest.webmanifest` y confirma que devuelve el JSON con `name: "Us"`.

- [ ] **Step 5: Commit y desplegar**

```bash
git add src/app/manifest.ts src/app/layout.tsx public/icon-192.png public/icon-512.png
git commit -m "feat: add PWA manifest and icons"
git push
```

Expected: Vercel despliega automáticamente. Visita la URL de producción, repite el recorrido completo del Task 11 Step 2 contra producción (no solo local), y confirma en Chrome móvil que aparece la opción "Añadir a pantalla de inicio".

---

## Siguientes planes

- **Plan 2 — Viajes:** esquema `places`/`place_visits`/`place_visit_participants`/`visit_photos`/`place_wishlist`, y las pantallas de visitados/pendientes validadas en el mockup.
- **Plan 3 — Retos:** esquema `challenges`/`challenge_completions`/`achievements`/`user_achievements`, flujo propuesta→aceptación→completado, puntos e insignias.
- **Plan 4 — Objetivos:** esquema `goals`/`goal_milestones`/`habit_checkins`, las tres formas de progreso (ahorro/hábito/vida), e integración del resumen en Inicio.

Cada uno se escribirá como un plan independiente cuando toque abordarlo.

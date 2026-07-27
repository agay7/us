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

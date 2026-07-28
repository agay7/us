export function getPostAuthRedirect(hasSpace: boolean): '/inicio' | '/welcome' {
  return hasSpace ? '/inicio' : '/welcome'
}

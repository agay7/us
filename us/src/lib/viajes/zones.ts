export type Zone = 'spain' | 'europe' | 'world'

export const ZONES: { value: Zone; label: string; icon: string }[] = [
  { value: 'spain', label: 'España', icon: '🇪🇸' },
  { value: 'europe', label: 'Europa', icon: '🇪🇺' },
  { value: 'world', label: 'Mundo', icon: '🌍' },
]

export function zoneLabel(zone: Zone): string {
  const found = ZONES.find((z) => z.value === zone)
  return found ? `${found.icon} ${found.label}` : zone
}

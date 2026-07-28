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

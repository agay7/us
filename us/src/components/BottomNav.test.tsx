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

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

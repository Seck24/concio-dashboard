import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Concio — Votre conciergerie sur pilote automatique',
  description: 'Gérez vos locations courte durée en toute simplicité avec Concio.',
  manifest: '/manifest.json',
  themeColor: '#1E2D40',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}

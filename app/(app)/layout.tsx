'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Building2, Sparkles, MessageSquare,
  Settings, CalendarDays, LogOut, Bell
} from 'lucide-react'
import Logo from '@/components/Logo'

const nav = [
  { href: '/dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/apartments',  label: 'Appartements',  icon: Building2 },
  { href: '/menages',     label: 'Ménages',        icon: Sparkles },
  { href: '/messages',    label: 'Messages',       icon: MessageSquare },
  { href: '/reglages',    label: 'Réglages',       icon: Settings },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [tenant, setTenant] = useState<{ name: string; email: string; plan: string } | null>(null)
  const [alertCount, setAlertCount] = useState(0)
  const [pendingDrafts, setPendingDrafts] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (!r.ok) { router.push('/login'); return null }
        return r.json()
      })
      .then(d => { if (d) setTenant(d) })
  }, [router])

  useEffect(() => {
    fetch('/api/alerts?status=pending&count=1')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setAlertCount(d.count ?? 0))
    fetch('/api/agent/pending')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setPendingDrafts(d.count ?? 0))
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const initials = tenant?.name
    ? tenant.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="app-shell">
      {/* SIDEBAR desktop */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={26} />
          <span>Concio</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={pathname.startsWith(href) ? 'active' : ''}>
              <Icon size={17} />
              {label}
              {href === '/dashboard' && alertCount > 0 && (
                <span className="badge badge-red" style={{ marginLeft: 'auto', padding: '1px 6px', fontSize: '11px' }}>
                  {alertCount}
                </span>
              )}
              {href === '/messages' && pendingDrafts > 0 && (
                <span className="badge badge-amber" style={{ marginLeft: 'auto', padding: '1px 6px', fontSize: '11px' }}>
                  {pendingDrafts}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-av">{initials}</div>
          <div className="sidebar-foot-info">
            <div className="name">{tenant?.name ?? '…'}</div>
            <div className="sub">{tenant?.plan === 'trial' ? 'Essai gratuit' : tenant?.plan}</div>
          </div>
          <button onClick={logout} className="btn btn-ghost btn-sm" title="Déconnexion" style={{ padding: '6px', marginLeft: 'auto' }}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="app-main">
        {children}
      </main>

      {/* BOTTOM NAV mobile */}
      <nav className="bottom-nav">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={pathname.startsWith(href) ? 'active' : ''}>
            <Icon size={20} />
            {label.split(' ')[0]}
          </Link>
        ))}
      </nav>
    </div>
  )
}

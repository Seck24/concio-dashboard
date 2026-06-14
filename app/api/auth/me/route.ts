import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const rows = await query<{ id: string; name: string; email: string; plan: string; whatsapp: string }>(
    'SELECT id, name, email, plan, whatsapp FROM tenants WHERE id = $1',
    [session.tenantId]
  )
  if (!rows.length) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })
  return NextResponse.json(rows[0])
}

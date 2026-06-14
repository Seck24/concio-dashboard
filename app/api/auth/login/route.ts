import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'
import { Tenant } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 })
  }

  const rows = await query<Tenant & { password_hash: string }>(
    'SELECT * FROM tenants WHERE email = $1 AND is_active = true LIMIT 1',
    [email.toLowerCase().trim()]
  )

  if (!rows.length) {
    return NextResponse.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 })
  }

  const tenant = rows[0]
  if (!tenant.password_hash) {
    return NextResponse.json({ error: 'Compte non configuré. Contactez le support.' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, tenant.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 })
  }

  const session = await getSession()
  session.isLoggedIn = true
  session.tenantId = tenant.id
  session.tenantName = tenant.name
  session.tenantEmail = tenant.email
  await session.save()

  return NextResponse.json({ ok: true, name: tenant.name })
}

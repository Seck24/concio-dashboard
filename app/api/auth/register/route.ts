import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json()
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Tous les champs sont requis.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Mot de passe trop court (6 caractères min).' }, { status: 400 })
  }

  const existing = await query('SELECT id FROM tenants WHERE email = $1', [email.toLowerCase().trim()])
  if (existing.length) {
    return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 })
  }

  const hash = await bcrypt.hash(password, 12)
  const rows = await query<{ id: string; name: string; email: string }>(
    `INSERT INTO tenants (name, email, password_hash, plan)
     VALUES ($1, $2, $3, 'trial')
     RETURNING id, name, email`,
    [name.trim(), email.toLowerCase().trim(), hash]
  )

  const tenant = rows[0]
  const session = await getSession()
  session.isLoggedIn = true
  session.tenantId = tenant.id
  session.tenantName = tenant.name
  session.tenantEmail = tenant.email
  await session.save()

  return NextResponse.json({ ok: true, name: tenant.name })
}

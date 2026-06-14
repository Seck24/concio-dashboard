import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const [tenant, rules, cleaners, platforms] = await Promise.all([
    query('SELECT id, name, email, whatsapp, plan FROM tenants WHERE id = $1', [tid]),
    query('SELECT * FROM rules WHERE tenant_id = $1', [tid]),
    query('SELECT * FROM cleaners WHERE tenant_id = $1 AND is_active = true ORDER BY name', [tid]),
    query('SELECT * FROM platforms ORDER BY name', []),
  ])

  return NextResponse.json({
    tenant: tenant[0],
    rules: rules[0] ?? null,
    cleaners,
    platforms,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId
  const body = await req.json()

  if (body.action === 'update_profile') {
    const { name, whatsapp } = body
    await query('UPDATE tenants SET name = $1, whatsapp = $2 WHERE id = $3', [name, whatsapp ?? null, tid])
    const session2 = await getSession()
    session2.tenantName = name
    await session2.save()
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'upsert_rules') {
    const { early_checkin_from, early_checkin_fee, late_checkout_until, late_checkout_fee, pets_allowed, parties_allowed, extra_notes } = body
    await query(
      `INSERT INTO rules (tenant_id, early_checkin_from, early_checkin_fee, late_checkout_until, late_checkout_fee, pets_allowed, parties_allowed, extra_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id) DO UPDATE SET
         early_checkin_from = EXCLUDED.early_checkin_from,
         early_checkin_fee  = EXCLUDED.early_checkin_fee,
         late_checkout_until = EXCLUDED.late_checkout_until,
         late_checkout_fee  = EXCLUDED.late_checkout_fee,
         pets_allowed       = EXCLUDED.pets_allowed,
         parties_allowed    = EXCLUDED.parties_allowed,
         extra_notes        = EXCLUDED.extra_notes`,
      [tid, early_checkin_from||null, early_checkin_fee||0, late_checkout_until||null, late_checkout_fee||0, pets_allowed||false, parties_allowed||false, extra_notes||null]
    )
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'add_cleaner') {
    const { name, whatsapp } = body
    if (!name || !whatsapp) return NextResponse.json({ error: 'Nom et WhatsApp requis.' }, { status: 400 })
    const rows = await query<{ id: string }>(
      'INSERT INTO cleaners (tenant_id, name, whatsapp) VALUES ($1,$2,$3) RETURNING id',
      [tid, name, whatsapp]
    )
    return NextResponse.json({ id: rows[0].id })
  }

  if (body.action === 'remove_cleaner') {
    await query('UPDATE cleaners SET is_active = false WHERE id = $1 AND tenant_id = $2', [body.id, tid])
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId
  const body = await req.json()

  const allowed = ['guest_phone', 'guest_name']
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  for (const f of allowed) {
    if (f in body) { sets.push(`${f} = $${i++}`); vals.push(body[f]) }
  }
  if (!sets.length) return NextResponse.json({ ok: true })

  vals.push(params.id, tid)
  await query(
    `UPDATE reservations SET ${sets.join(', ')}
     WHERE id = $${i++} AND apartment_id IN (SELECT id FROM apartments WHERE tenant_id = $${i})`,
    vals
  )
  return NextResponse.json({ ok: true })
}

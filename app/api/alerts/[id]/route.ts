import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId
  const { status } = await req.json()

  if (!['resolved', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  await query(
    `UPDATE alerts SET status = $1, resolved_at = now()
     WHERE id = $2 AND tenant_id = $3`,
    [status, params.id, tid]
  )
  return NextResponse.json({ ok: true })
}

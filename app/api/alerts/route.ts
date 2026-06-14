import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'pending'
  const countOnly = url.searchParams.get('count') === '1'

  if (countOnly) {
    const rows = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM alerts WHERE tenant_id = $1 AND status = $2`,
      [tid, status]
    )
    return NextResponse.json({ count: parseInt(rows[0]?.count ?? '0') })
  }

  const alerts = await query(
    `SELECT a.*, ap.name AS apartment_name
     FROM alerts a
     LEFT JOIN apartments ap ON ap.id = a.apartment_id
     WHERE a.tenant_id = $1 AND a.status = $2
     ORDER BY a.created_at DESC`,
    [tid, status]
  )
  return NextResponse.json(alerts)
}

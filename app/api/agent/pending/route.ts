import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ count: 0 })

  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.tenant_id = $1 AND m.status = 'draft'`,
    [session.tenantId]
  )
  return NextResponse.json({ count: parseInt(rows[0]?.count ?? '0') })
}

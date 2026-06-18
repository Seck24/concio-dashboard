import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const rows = await query<{
    id: string; guest_name?: string; guest_phone: string; status: string
    apartment_name?: string; updated_at: string
    last_message?: string; last_role?: string; message_count: number
  }>(
    `SELECT c.id, c.guest_name, c.guest_phone, c.status, c.updated_at,
            a.name AS apartment_name,
            (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) AS last_message,
            (SELECT role FROM messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) AS last_role,
            (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id)::int AS message_count
     FROM conversations c
     LEFT JOIN apartments a ON a.id = c.apartment_id
     WHERE c.tenant_id = $1
     ORDER BY c.updated_at DESC
     LIMIT 100`,
    [tid]
  )

  return NextResponse.json(rows)
}

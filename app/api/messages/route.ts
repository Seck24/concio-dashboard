import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  // Latest message per reservation, ordered by most recent
  const threads = await query(
    `SELECT DISTINCT ON (r.id)
       r.id AS reservation_id, r.guest_name, r.checkin, r.checkout,
       a.name AS apartment_name, a.id AS apartment_id,
       m.content AS last_message, m.sent_at AS last_sent, m.direction AS last_direction, m.is_bot,
       (SELECT COUNT(*) FROM messages WHERE reservation_id = r.id AND is_read = false AND direction = 'inbound') AS unread_count
     FROM reservations r
     JOIN apartments a ON a.id = r.apartment_id
     LEFT JOIN messages m ON m.reservation_id = r.id
     WHERE a.tenant_id = $1 AND r.status = 'confirmed'
     ORDER BY r.id, m.sent_at DESC NULLS LAST`,
    [tid]
  )
  return NextResponse.json(threads)
}

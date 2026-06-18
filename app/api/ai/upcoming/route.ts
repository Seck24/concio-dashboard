import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const rows = await query<{
    id: string
    guest_name?: string
    checkin: string
    checkout: string
    status: string
    platform_slug?: string
    apartment_id: string
    apartment_name: string
    access_code?: string
    access_instructions?: string
    drive_link_photos?: string
    address?: string
  }>(
    `SELECT r.id, r.guest_name, r.checkin, r.checkout, r.status, r.platform_slug,
            a.id AS apartment_id, a.name AS apartment_name,
            a.access_code, a.access_instructions, a.drive_link_photos, a.address
     FROM reservations r
     JOIN apartments a ON a.id = r.apartment_id
     WHERE a.tenant_id = $1
       AND r.status = 'confirmed'
       AND r.checkin >= CURRENT_DATE
       AND r.checkin <= CURRENT_DATE + interval '30 days'
     ORDER BY r.checkin ASC
     LIMIT 50`,
    [tid]
  )

  return NextResponse.json(rows)
}

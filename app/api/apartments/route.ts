import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const apartments = await query(
    `SELECT a.*,
       COALESCE(
         json_agg(
           json_build_object('slug', p.slug, 'name', p.name, 'color', p.color)
         ) FILTER (WHERE p.id IS NOT NULL),
         '[]'
       ) AS platforms,
       r.guest_name AS current_guest,
       r.checkout AS current_checkout,
       r_next.guest_name AS next_guest,
       r_next.checkin AS next_checkin
     FROM apartments a
     LEFT JOIN apartment_platforms ap ON ap.apartment_id = a.id
     LEFT JOIN platforms p ON p.id = ap.platform_id
     LEFT JOIN reservations r ON r.apartment_id = a.id
       AND r.status = 'confirmed' AND r.checkin <= now() AND r.checkout > now()
     LEFT JOIN reservations r_next ON r_next.apartment_id = a.id
       AND r_next.status = 'confirmed' AND r_next.checkin > now()
       AND r_next.checkin = (
         SELECT MIN(checkin) FROM reservations
         WHERE apartment_id = a.id AND status = 'confirmed' AND checkin > now()
       )
     WHERE a.tenant_id = $1 AND a.is_active = true
     GROUP BY a.id, r.guest_name, r.checkout, r_next.guest_name, r_next.checkin
     ORDER BY a.name`,
    [tid]
  )

  return NextResponse.json(apartments)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const { name, address, floor, access_code, access_instructions, drive_link_photos, expected_cleaning_min } = await req.json()
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const rows = await query<{ id: string }>(
    `INSERT INTO apartments (tenant_id, name, address, floor, access_code, access_instructions, drive_link_photos, expected_cleaning_min)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [tid, name, address ?? null, floor ?? null, access_code ?? null,
     access_instructions ?? null, drive_link_photos ?? null, expected_cleaning_min ?? 90]
  )

  const aptId = rows[0].id
  // Generate QR code token
  await query(
    `INSERT INTO qr_codes (apartment_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [aptId]
  )

  return NextResponse.json({ id: aptId }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const [apt] = await query(
    `SELECT a.*,
       COALESCE(
         json_agg(
           json_build_object('slug', p.slug, 'name', p.name, 'color', p.color, 'ical_url', ap.ical_url, 'last_synced_at', ap.last_synced_at)
         ) FILTER (WHERE p.id IS NOT NULL),
         '[]'
       ) AS platforms
     FROM apartments a
     LEFT JOIN apartment_platforms ap ON ap.apartment_id = a.id
     LEFT JOIN platforms p ON p.id = ap.platform_id
     WHERE a.id = $1 AND a.tenant_id = $2 AND a.is_active = true
     GROUP BY a.id`,
    [params.id, tid]
  )
  if (!apt) return NextResponse.json({ error: 'Appartement introuvable' }, { status: 404 })

  const [reservations, cleaning, consumables, qr] = await Promise.all([
    query(
      `SELECT r.*, p.slug AS platform_slug, p.color AS platform_color
       FROM reservations r
       LEFT JOIN platforms p ON p.id = r.platform_id
       WHERE r.apartment_id = $1 AND r.status != 'cancelled'
       ORDER BY r.checkin DESC LIMIT 30`,
      [params.id]
    ),
    query(
      `SELECT cs.*, cl.name AS cleaner_name
       FROM cleaning_sessions cs
       LEFT JOIN cleaners cl ON cl.id = cs.cleaner_id
       WHERE cs.apartment_id = $1
       ORDER BY cs.planned_start DESC LIMIT 20`,
      [params.id]
    ),
    query('SELECT * FROM consumables WHERE apartment_id = $1 ORDER BY name', [params.id]),
    query('SELECT token FROM qr_codes WHERE apartment_id = $1', [params.id]),
  ])

  return NextResponse.json({ apt, reservations, cleaning, consumables, qr: qr[0] ?? null })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId
  const body = await req.json()

  const fields = ['name','address','floor','access_code','access_instructions','drive_link_photos','expected_cleaning_min','city_info','activities_nearby','parking_tips']
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  for (const f of fields) {
    if (f in body) { sets.push(`${f} = $${i++}`); vals.push(body[f]) }
  }
  if (!sets.length) return NextResponse.json({ ok: true })

  vals.push(params.id, tid)
  await query(
    `UPDATE apartments SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i}`,
    vals
  )
  return NextResponse.json({ ok: true })
}

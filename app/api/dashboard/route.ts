import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const [overview, alerts, stats] = await Promise.all([
    query(
      `SELECT * FROM today_overview WHERE tenant_id = $1 ORDER BY checkin ASC NULLS LAST`,
      [tid]
    ),
    query(
      `SELECT a.*, ap.name AS apartment_name
       FROM alerts a
       LEFT JOIN apartments ap ON ap.id = a.apartment_id
       WHERE a.tenant_id = $1 AND a.status = 'pending'
       ORDER BY a.created_at DESC LIMIT 10`,
      [tid]
    ),
    query(
      `SELECT
         COUNT(DISTINCT CASE WHEN DATE(r.checkin AT TIME ZONE 'Europe/Paris') = CURRENT_DATE THEN r.id END) AS arrivals,
         COUNT(DISTINCT CASE WHEN DATE(r.checkout AT TIME ZONE 'Europe/Paris') = CURRENT_DATE THEN r.id END) AS departures,
         COUNT(DISTINCT CASE WHEN cs.status = 'in_progress' THEN cs.id END) AS cleanings_in_progress,
         COUNT(DISTINCT al.id) FILTER (WHERE al.status = 'pending') AS open_alerts
       FROM apartments apt
       LEFT JOIN reservations r ON r.apartment_id = apt.id
         AND r.status = 'confirmed'
         AND (DATE(r.checkin AT TIME ZONE 'Europe/Paris') = CURRENT_DATE OR DATE(r.checkout AT TIME ZONE 'Europe/Paris') = CURRENT_DATE)
       LEFT JOIN cleaning_sessions cs ON cs.apartment_id = apt.id
         AND DATE(cs.planned_start AT TIME ZONE 'Europe/Paris') = CURRENT_DATE
       LEFT JOIN alerts al ON al.tenant_id = $1 AND al.status = 'pending'
       WHERE apt.tenant_id = $1 AND apt.is_active = true`,
      [tid]
    ),
  ])

  return NextResponse.json({ overview, alerts, stats: stats[0] ?? {} })
}

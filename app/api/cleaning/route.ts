import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId
  const url = new URL(req.url)
  const week = url.searchParams.get('week') // ISO date of Monday

  let dateFilter = 'DATE(cs.planned_start) >= CURRENT_DATE - INTERVAL \'7 days\''
  const vals: unknown[] = [tid]
  if (week) {
    dateFilter = `DATE(cs.planned_start) >= $2 AND DATE(cs.planned_start) < ($2::date + INTERVAL '7 days')`
    vals.push(week)
  }

  const sessions = await query(
    `SELECT cs.*, a.name AS apartment_name, cl.name AS cleaner_name,
       (SELECT heure FROM pointages WHERE cleaning_session_id = cs.id AND type = 'arrivee' ORDER BY heure LIMIT 1) AS actual_start,
       (SELECT heure FROM pointages WHERE cleaning_session_id = cs.id AND type = 'depart' ORDER BY heure DESC LIMIT 1) AS actual_end
     FROM cleaning_sessions cs
     JOIN apartments a ON a.id = cs.apartment_id
     LEFT JOIN cleaners cl ON cl.id = cs.cleaner_id
     WHERE a.tenant_id = $1 AND ${dateFilter}
     ORDER BY cs.planned_start DESC`,
    vals
  )
  return NextResponse.json(sessions)
}

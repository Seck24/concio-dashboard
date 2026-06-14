import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET — récupère l'état du QR (appartement + état en cours)
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const rows = await query<{
    apartment_id: string; apartment_name: string; expected_cleaning_min: number;
    cleaning_session_id: string | null; cleaning_status: string | null;
    arrivee_heure: string | null; cleaner_name: string | null;
  }>(
    `SELECT
       a.id AS apartment_id, a.name AS apartment_name, a.expected_cleaning_min,
       cs.id AS cleaning_session_id, cs.status AS cleaning_status,
       (SELECT heure FROM pointages WHERE cleaning_session_id = cs.id AND type = 'arrivee' ORDER BY heure LIMIT 1) AS arrivee_heure,
       cl.name AS cleaner_name
     FROM qr_codes qr
     JOIN apartments a ON a.id = qr.apartment_id
     LEFT JOIN cleaning_sessions cs ON cs.apartment_id = a.id
       AND DATE(cs.planned_start) = CURRENT_DATE
     LEFT JOIN cleaners cl ON cl.id = cs.cleaner_id
     WHERE qr.token = $1 AND a.is_active = true
     ORDER BY
       CASE cs.status WHEN 'in_progress' THEN 1 WHEN 'planned' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END ASC,
       cs.planned_start ASC NULLS LAST
     LIMIT 1`,
    [params.token]
  )

  if (!rows.length) {
    return NextResponse.json({ error: 'QR code invalide ou expiré.' }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}

// POST — enregistre un pointage (arrivee ou depart)
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { type, cleaner_name } = await req.json()

  if (!['arrivee', 'depart'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide.' }, { status: 400 })
  }

  // Lookup apartment via token
  const qrRows = await query<{ apartment_id: string; expected_cleaning_min: number }>(
    `SELECT a.id AS apartment_id, a.expected_cleaning_min
     FROM qr_codes qr JOIN apartments a ON a.id = qr.apartment_id
     WHERE qr.token = $1 AND a.is_active = true`,
    [params.token]
  )
  if (!qrRows.length) return NextResponse.json({ error: 'QR invalide.' }, { status: 404 })

  const { apartment_id, expected_cleaning_min } = qrRows[0]

  // Find or create today's cleaning session
  let sessionRows = await query<{ id: string; status: string }>(
    `SELECT id, status FROM cleaning_sessions
     WHERE apartment_id = $1 AND DATE(planned_start) = CURRENT_DATE
       AND status IN ('planned','in_progress')
     ORDER BY planned_start ASC LIMIT 1`,
    [apartment_id]
  )

  let sessionId: string

  if (type === 'arrivee') {
    if (!sessionRows.length) {
      // Create an ad-hoc session
      const now = new Date()
      const end = new Date(now.getTime() + expected_cleaning_min * 60000)
      const newSess = await query<{ id: string }>(
        `INSERT INTO cleaning_sessions (apartment_id, planned_start, planned_end, planned_duration_min, status)
         VALUES ($1, now(), $2, $3, 'in_progress') RETURNING id`,
        [apartment_id, end.toISOString(), expected_cleaning_min]
      )
      sessionId = newSess[0].id
    } else {
      sessionId = sessionRows[0].id
      await query(
        `UPDATE cleaning_sessions SET status = 'in_progress' WHERE id = $1`,
        [sessionId]
      )
    }
  } else {
    // depart
    if (!sessionRows.length) return NextResponse.json({ error: 'Aucun ménage en cours.' }, { status: 400 })
    sessionId = sessionRows[0].id

    // Calculate actual duration
    const arrRows = await query<{ heure: string }>(
      `SELECT heure FROM pointages WHERE cleaning_session_id = $1 AND type = 'arrivee' ORDER BY heure LIMIT 1`,
      [sessionId]
    )
    const arrivalTime = arrRows[0]?.heure ? new Date(arrRows[0].heure) : new Date()
    const actualMin = Math.round((Date.now() - arrivalTime.getTime()) / 60000)

    await query(
      `UPDATE cleaning_sessions SET status = 'completed', actual_duration_min = $1 WHERE id = $2`,
      [actualMin, sessionId]
    )
  }

  // Insert pointage
  await query(
    `INSERT INTO pointages (cleaning_session_id, apartment_id, type, heure)
     VALUES ($1, $2, $3, now())`,
    [sessionId, apartment_id, type]
  )

  // Return duration for completion screen
  let actualMin: number | null = null
  if (type === 'depart') {
    const arrRows = await query<{ heure: string }>(
      `SELECT heure FROM pointages WHERE cleaning_session_id = $1 AND type = 'arrivee' ORDER BY heure LIMIT 1`,
      [sessionId]
    )
    if (arrRows[0]) {
      actualMin = Math.round((Date.now() - new Date(arrRows[0].heure).getTime()) / 60000)
    }
  }

  return NextResponse.json({ ok: true, session_id: sessionId, actual_min: actualMin })
}

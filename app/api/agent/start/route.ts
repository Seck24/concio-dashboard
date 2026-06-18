import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'
import { agentReply } from '@/lib/agent'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const { reservation_id } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id requis.' }, { status: 400 })

  // Check if conversation already exists
  const existing = await query<{ id: string }>(
    'SELECT id FROM conversations WHERE reservation_id = $1 AND tenant_id = $2',
    [reservation_id, tid]
  )
  if (existing.length) return NextResponse.json({ conversation_id: existing[0].id, already_exists: true })

  const [resvRows, tenantRows] = await Promise.all([
    query<{
      guest_name?: string; guest_phone?: string; checkin: string; checkout: string
      apartment_id: string; apartment_name: string; carnet_appartement?: string
    }>(
      `SELECT r.guest_name, r.guest_phone, r.checkin, r.checkout,
              a.id AS apartment_id, a.name AS apartment_name, a.carnet_appartement
       FROM reservations r
       JOIN apartments a ON a.id = r.apartment_id
       WHERE r.id = $1 AND a.tenant_id = $2`,
      [reservation_id, tid]
    ),
    query<{ carnet_hote?: string }>(
      'SELECT carnet_hote FROM tenants WHERE id = $1',
      [tid]
    ),
  ])

  if (!resvRows.length) return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 })
  const r = resvRows[0]
  if (!r.guest_phone) return NextResponse.json({ error: 'Numéro de téléphone du voyageur manquant.' }, { status: 400 })

  const draft = await agentReply({
    carnet_hote: tenantRows[0]?.carnet_hote,
    carnet_appartement: r.carnet_appartement,
    apartment_name: r.apartment_name,
    guest_name: r.guest_name,
    checkin: r.checkin,
    checkout: r.checkout,
    history: [],
    newMessage: `[SYSTÈME] Génère le message de bienvenue initial que l'hôte va envoyer au voyageur dès la confirmation de sa réservation. Sois chaleureux, présente le logement et dis-lui que tu es disponible pour toute question.`,
  })

  const convRows = await query<{ id: string }>(
    `INSERT INTO conversations (tenant_id, reservation_id, apartment_id, guest_name, guest_phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tid, reservation_id, r.apartment_id, r.guest_name ?? null, r.guest_phone]
  )
  const convId = convRows[0].id

  // Store as draft (not sent yet)
  await query(
    `INSERT INTO messages (conversation_id, role, content, status) VALUES ($1, 'assistant', $2, 'draft')`,
    [convId, draft]
  )

  await query('UPDATE conversations SET updated_at = now() WHERE id = $1', [convId])

  return NextResponse.json({ conversation_id: convId, draft })
}

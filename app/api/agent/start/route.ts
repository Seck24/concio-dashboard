import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'
import { agentReply, AgentContext } from '@/lib/agent'
import { sendSMS } from '@/lib/twilio'

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

  // Fetch reservation + apartment + tenant + rules
  const [resvRows, tenantRows, rulesRows] = await Promise.all([
    query<{
      guest_name?: string; guest_phone?: string; checkin: string; checkout: string; platform_slug?: string
      apartment_id: string; apartment_name: string; access_code?: string; access_instructions?: string
      drive_link_photos?: string; address?: string; city_info?: string; activities_nearby?: string; parking_tips?: string
    }>(
      `SELECT r.guest_name, r.guest_phone, r.checkin, r.checkout, r.platform_slug,
              a.id AS apartment_id, a.name AS apartment_name, a.access_code,
              a.access_instructions, a.drive_link_photos, a.address,
              a.city_info, a.activities_nearby, a.parking_tips
       FROM reservations r
       JOIN apartments a ON a.id = r.apartment_id
       WHERE r.id = $1 AND a.tenant_id = $2`,
      [reservation_id, tid]
    ),
    query<{ host_name?: string; ton_de_voix?: string; exemple_messages?: string }>(
      'SELECT host_name, ton_de_voix, exemple_messages FROM tenants WHERE id = $1',
      [tid]
    ),
    query<{ early_checkin_from?: string; late_checkout_until?: string; pets_allowed?: boolean; extra_notes?: string }>(
      'SELECT early_checkin_from, late_checkout_until, pets_allowed, extra_notes FROM rules WHERE tenant_id = $1',
      [tid]
    ),
  ])

  if (!resvRows.length) return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 })

  const r = resvRows[0]
  if (!r.guest_phone) return NextResponse.json({ error: 'Numéro de téléphone du voyageur manquant.' }, { status: 400 })

  const t = tenantRows[0]

  // Build context for welcome message
  const ctx: AgentContext = {
    tenant: { host_name: t?.host_name, ton_de_voix: t?.ton_de_voix },
    apartment: {
      name: r.apartment_name,
      address: r.address,
      access_code: r.access_code,
      access_instructions: r.access_instructions,
      drive_link_photos: r.drive_link_photos,
      city_info: r.city_info,
      activities_nearby: r.activities_nearby,
      parking_tips: r.parking_tips,
    },
    reservation: { guest_name: r.guest_name, checkin: r.checkin, checkout: r.checkout },
    rules: rulesRows[0],
    history: [],
    newMessage: `[SYSTÈME] Génère le message de bienvenue initial pour ce voyageur. C'est le premier message que le voyageur va recevoir à la confirmation de sa réservation. Sois chaleureux, présente-toi et le logement, et indique que tu es disponible pour toute question.`,
  }

  const welcomeText = await agentReply(ctx)

  // Create conversation
  const convRows = await query<{ id: string }>(
    `INSERT INTO conversations (tenant_id, reservation_id, apartment_id, guest_name, guest_phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tid, reservation_id, r.apartment_id, r.guest_name ?? null, r.guest_phone]
  )
  const convId = convRows[0].id

  // Store welcome message
  await query(
    `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
    [convId, welcomeText]
  )

  // Send SMS
  try {
    await sendSMS(r.guest_phone, welcomeText)
  } catch (err) {
    console.error('[Agent] SMS send error:', err)
    // Don't fail — conversation is created, SMS can be retried
  }

  // Update conversation timestamp
  await query('UPDATE conversations SET updated_at = now() WHERE id = $1', [convId])

  return NextResponse.json({ conversation_id: convId, message: welcomeText })
}

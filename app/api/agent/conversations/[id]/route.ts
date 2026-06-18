import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'
import { agentReply } from '@/lib/agent'
import { sendSMS } from '@/lib/twilio'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const [convRows, msgRows] = await Promise.all([
    query<{ id: string; guest_name?: string; guest_phone: string; status: string; apartment_name?: string; reservation_id?: string }>(
      `SELECT c.id, c.guest_name, c.guest_phone, c.status, c.reservation_id,
              a.name AS apartment_name
       FROM conversations c LEFT JOIN apartments a ON a.id = c.apartment_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [params.id, tid]
    ),
    query<{ id: string; role: string; content: string; status: string; sent_at: string }>(
      `SELECT id, role, content, status, sent_at FROM messages
       WHERE conversation_id = $1 ORDER BY sent_at ASC`,
      [params.id]
    ),
  ])

  if (!convRows.length) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })
  return NextResponse.json({ conversation: convRows[0], messages: msgRows })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const body = await req.json()
  const { action } = body

  const convRows = await query<{ id: string; guest_phone: string; apartment_id?: string; reservation_id?: string }>(
    'SELECT id, guest_phone, apartment_id, reservation_id FROM conversations WHERE id = $1 AND tenant_id = $2',
    [params.id, tid]
  )
  if (!convRows.length) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })
  const conv = convRows[0]

  // Send a draft message (SMS)
  if (action === 'send') {
    const { message_id } = body
    const msgRows = await query<{ id: string; content: string }>(
      `SELECT id, content FROM messages WHERE id = $1 AND conversation_id = $2 AND status = 'draft'`,
      [message_id, params.id]
    )
    if (!msgRows.length) return NextResponse.json({ error: 'Brouillon introuvable.' }, { status: 404 })

    await sendSMS(conv.guest_phone, msgRows[0].content)
    await query(`UPDATE messages SET status = 'sent' WHERE id = $1`, [message_id])
    await query('UPDATE conversations SET updated_at = now() WHERE id = $1', [params.id])
    return NextResponse.json({ ok: true })
  }

  // Revise a draft using the agent
  if (action === 'revise') {
    const { message_id, instruction } = body
    if (!instruction?.trim()) return NextResponse.json({ error: 'Instruction manquante.' }, { status: 400 })

    const msgRows = await query<{ id: string; content: string }>(
      `SELECT id, content FROM messages WHERE id = $1 AND conversation_id = $2 AND status = 'draft'`,
      [message_id, params.id]
    )
    if (!msgRows.length) return NextResponse.json({ error: 'Brouillon introuvable.' }, { status: 404 })

    const [tenantRows, resvRows, aptRows, historyRows] = await Promise.all([
      query<{ carnet_hote?: string }>('SELECT carnet_hote FROM tenants WHERE id = $1', [tid]),
      conv.reservation_id
        ? query<{ guest_name?: string; checkin: string; checkout: string }>(
            'SELECT guest_name, checkin, checkout FROM reservations WHERE id = $1', [conv.reservation_id]
          )
        : Promise.resolve([]),
      conv.apartment_id
        ? query<{ name: string; carnet_appartement?: string }>(
            'SELECT name, carnet_appartement FROM apartments WHERE id = $1', [conv.apartment_id]
          )
        : Promise.resolve([]),
      query<{ role: string; content: string }>(
        `SELECT role, content FROM messages WHERE conversation_id = $1 AND status != 'draft'
         ORDER BY sent_at DESC LIMIT 20`,
        [params.id]
      ),
    ])

    const history = historyRows.reverse().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const revised = await agentReply({
      carnet_hote: tenantRows[0]?.carnet_hote,
      carnet_appartement: aptRows[0]?.carnet_appartement,
      apartment_name: aptRows[0]?.name ?? 'logement',
      guest_name: resvRows[0]?.guest_name,
      checkin: resvRows[0]?.checkin,
      checkout: resvRows[0]?.checkout,
      history,
      newMessage: `[RÉVISION DEMANDÉE] Voici le brouillon actuel :\n"${msgRows[0].content}"\n\nInstruction de l'hôte : ${instruction}\n\nGénère la version révisée uniquement.`,
    })

    await query(`UPDATE messages SET content = $1 WHERE id = $2`, [revised, message_id])
    return NextResponse.json({ ok: true, content: revised })
  }

  // Send a new manual message (from host, bypasses AI)
  if (action === 'send_manual') {
    const { content } = body
    if (!content?.trim()) return NextResponse.json({ error: 'Message vide.' }, { status: 400 })

    await sendSMS(conv.guest_phone, content)
    await query(
      `INSERT INTO messages (conversation_id, role, content, status) VALUES ($1, 'assistant', $2, 'sent')`,
      [params.id, content]
    )
    await query('UPDATE conversations SET updated_at = now() WHERE id = $1', [params.id])
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
}

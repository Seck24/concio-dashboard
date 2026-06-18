import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { agentReply } from '@/lib/agent'

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })
  }

  const form = await req.formData()
  const from = (form.get('From') as string)?.trim()
  const body = (form.get('Body') as string)?.trim()

  if (!from || !body) {
    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })
  }

  const convRows = await query<{ id: string; tenant_id: string; reservation_id?: string; apartment_id?: string; guest_name?: string }>(
    `SELECT id, tenant_id, reservation_id, apartment_id, guest_name
     FROM conversations WHERE guest_phone = $1 AND status = 'active'
     ORDER BY updated_at DESC LIMIT 1`,
    [from]
  )
  if (!convRows.length) return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })

  const conv = convRows[0]
  const tid = conv.tenant_id

  // Store inbound message as 'received'
  await query(
    `INSERT INTO messages (conversation_id, role, content, status) VALUES ($1, 'user', $2, 'received')`,
    [conv.id, body]
  )

  // Fetch context
  const [tenantRows, resvRows, aptRows, historyRows] = await Promise.all([
    query<{ carnet_hote?: string }>('SELECT carnet_hote FROM tenants WHERE id = $1', [tid]),
    conv.reservation_id
      ? query<{ guest_name?: string; checkin: string; checkout: string }>(
          'SELECT guest_name, checkin, checkout FROM reservations WHERE id = $1',
          [conv.reservation_id]
        )
      : Promise.resolve([]),
    conv.apartment_id
      ? query<{ name: string; carnet_appartement?: string }>(
          'SELECT name, carnet_appartement FROM apartments WHERE id = $1',
          [conv.apartment_id]
        )
      : Promise.resolve([]),
    query<{ role: string; content: string; status: string }>(
      `SELECT role, content, status FROM messages
       WHERE conversation_id = $1 AND status != 'draft'
       ORDER BY sent_at DESC LIMIT 20`,
      [conv.id]
    ),
  ])

  const resv = resvRows[0]
  const apt = aptRows[0]

  // History in chronological order, exclude the message we just stored
  const history = historyRows
    .reverse()
    .slice(0, -1)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  try {
    const draft = await agentReply({
      carnet_hote: tenantRows[0]?.carnet_hote,
      carnet_appartement: apt?.carnet_appartement,
      apartment_name: apt?.name ?? 'logement',
      guest_name: resv?.guest_name ?? conv.guest_name,
      checkin: resv?.checkin,
      checkout: resv?.checkout,
      history,
      newMessage: body,
    })

    // Store reply as draft — host must approve before SMS is sent
    await query(
      `INSERT INTO messages (conversation_id, role, content, status) VALUES ($1, 'assistant', $2, 'draft')`,
      [conv.id, draft]
    )

    await query('UPDATE conversations SET updated_at = now() WHERE id = $1', [conv.id])
  } catch (err) {
    console.error('[Webhook] Agent error:', err)
  }

  return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })
}

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { agentReply, AgentContext } from '@/lib/agent'
import { sendSMS } from '@/lib/twilio'

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

export async function POST(req: NextRequest) {
  // Basic secret check to avoid random POSTs
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Twilio sends form-encoded body
  const form = await req.formData()
  const from = (form.get('From') as string)?.trim()
  const body = (form.get('Body') as string)?.trim()

  if (!from || !body) {
    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Find active conversation by guest phone
  const convRows = await query<{ id: string; tenant_id: string; reservation_id?: string; apartment_id?: string; guest_name?: string }>(
    `SELECT id, tenant_id, reservation_id, apartment_id, guest_name
     FROM conversations
     WHERE guest_phone = $1 AND status = 'active'
     ORDER BY updated_at DESC LIMIT 1`,
    [from]
  )

  if (!convRows.length) {
    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })
  }

  const conv = convRows[0]
  const tid = conv.tenant_id

  // Store incoming message
  await query(
    `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
    [conv.id, body]
  )

  // Fetch context
  const [tenantRows, rulesRows, resvRows, aptRows, historyRows] = await Promise.all([
    query<{ host_name?: string; ton_de_voix?: string }>(
      'SELECT host_name, ton_de_voix FROM tenants WHERE id = $1',
      [tid]
    ),
    query<{ early_checkin_from?: string; late_checkout_until?: string; pets_allowed?: boolean; extra_notes?: string }>(
      'SELECT early_checkin_from, late_checkout_until, pets_allowed, extra_notes FROM rules WHERE tenant_id = $1',
      [tid]
    ),
    conv.reservation_id
      ? query<{ guest_name?: string; checkin: string; checkout: string }>(
          'SELECT guest_name, checkin, checkout FROM reservations WHERE id = $1',
          [conv.reservation_id]
        )
      : Promise.resolve([]),
    conv.apartment_id
      ? query<{ name: string; address?: string; access_code?: string; access_instructions?: string; drive_link_photos?: string; city_info?: string; activities_nearby?: string; parking_tips?: string }>(
          'SELECT name, address, access_code, access_instructions, drive_link_photos, city_info, activities_nearby, parking_tips FROM apartments WHERE id = $1',
          [conv.apartment_id]
        )
      : Promise.resolve([]),
    query<{ role: string; content: string }>(
      `SELECT role, content FROM messages
       WHERE conversation_id = $1
       ORDER BY sent_at DESC LIMIT 20`,
      [conv.id]
    ),
  ])

  const apt = aptRows[0]
  const resv = resvRows[0]
  const tenant = tenantRows[0]

  // Build context (history in chronological order, excluding last user message we just stored)
  const history = historyRows
    .reverse()
    .slice(0, -1) // remove the one we just inserted (it's in newMessage)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const ctx: AgentContext = {
    tenant: { host_name: tenant?.host_name, ton_de_voix: tenant?.ton_de_voix },
    apartment: apt ?? { name: 'logement' },
    reservation: resv ?? { guest_name: conv.guest_name, checkin: '', checkout: '' },
    rules: rulesRows[0],
    history,
    newMessage: body,
  }

  try {
    const reply = await agentReply(ctx)

    // Store reply
    await query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
      [conv.id, reply]
    )

    // Send SMS
    await sendSMS(from, reply)

    // Update conversation timestamp
    await query('UPDATE conversations SET updated_at = now() WHERE id = $1', [conv.id])
  } catch (err) {
    console.error('[Webhook] Agent error:', err)
  }

  return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })
}

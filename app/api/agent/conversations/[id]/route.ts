import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'
import { agentReply, AgentContext } from '@/lib/agent'
import { sendSMS } from '@/lib/twilio'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const [convRows, msgRows] = await Promise.all([
    query<{ id: string; guest_name?: string; guest_phone: string; status: string; apartment_name?: string; reservation_id?: string }>(
      `SELECT c.id, c.guest_name, c.guest_phone, c.status, c.reservation_id,
              a.name AS apartment_name
       FROM conversations c
       LEFT JOIN apartments a ON a.id = c.apartment_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [params.id, tid]
    ),
    query<{ id: string; role: string; content: string; sent_at: string }>(
      `SELECT id, role, content, sent_at FROM messages
       WHERE conversation_id = $1
       ORDER BY sent_at ASC`,
      [params.id]
    ),
  ])

  if (!convRows.length) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })

  return NextResponse.json({ conversation: convRows[0], messages: msgRows })
}

// Manual reply from dashboard
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId
  const { content, use_ai } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Message vide.' }, { status: 400 })

  const convRows = await query<{ id: string; guest_phone: string; apartment_id?: string; reservation_id?: string }>(
    'SELECT id, guest_phone, apartment_id, reservation_id FROM conversations WHERE id = $1 AND tenant_id = $2',
    [params.id, tid]
  )
  if (!convRows.length) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })
  const conv = convRows[0]

  let finalContent = content

  if (use_ai) {
    const [tenantRows, rulesRows, resvRows, aptRows, historyRows] = await Promise.all([
      query<{ host_name?: string; ton_de_voix?: string }>(
        'SELECT host_name, ton_de_voix FROM tenants WHERE id = $1', [tid]
      ),
      query<{ early_checkin_from?: string; late_checkout_until?: string; pets_allowed?: boolean; extra_notes?: string }>(
        'SELECT early_checkin_from, late_checkout_until, pets_allowed, extra_notes FROM rules WHERE tenant_id = $1', [tid]
      ),
      conv.reservation_id
        ? query<{ guest_name?: string; checkin: string; checkout: string }>(
            'SELECT guest_name, checkin, checkout FROM reservations WHERE id = $1', [conv.reservation_id]
          )
        : Promise.resolve([]),
      conv.apartment_id
        ? query<{ name: string; address?: string; access_code?: string; access_instructions?: string; drive_link_photos?: string; city_info?: string; activities_nearby?: string; parking_tips?: string }>(
            'SELECT name, address, access_code, access_instructions, drive_link_photos, city_info, activities_nearby, parking_tips FROM apartments WHERE id = $1', [conv.apartment_id]
          )
        : Promise.resolve([]),
      query<{ role: string; content: string }>(
        'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY sent_at DESC LIMIT 20', [params.id]
      ),
    ])

    const history = historyRows.reverse().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const ctx: AgentContext = {
      tenant: { host_name: tenantRows[0]?.host_name, ton_de_voix: tenantRows[0]?.ton_de_voix },
      apartment: aptRows[0] ?? { name: 'logement' },
      reservation: resvRows[0] ?? { guest_name: undefined, checkin: '', checkout: '' },
      rules: rulesRows[0],
      history,
      newMessage: content,
    }
    finalContent = await agentReply(ctx)
  }

  await query(
    `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
    [params.id, finalContent]
  )

  try {
    await sendSMS(conv.guest_phone, finalContent)
  } catch (err) {
    console.error('[Reply] SMS error:', err)
  }

  await query('UPDATE conversations SET updated_at = now() WHERE id = $1', [params.id])

  return NextResponse.json({ ok: true, content: finalContent })
}

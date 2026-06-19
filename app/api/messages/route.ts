import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// Cette route est remplacée par /api/agent/conversations
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return NextResponse.json([])
}

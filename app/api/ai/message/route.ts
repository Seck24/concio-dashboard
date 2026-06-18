import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const tid = session.tenantId

  const { reservation_id } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id requis.' }, { status: 400 })

  const [resvRows, tenantRows, rulesRows] = await Promise.all([
    query<{
      guest_name?: string; checkin: string; checkout: string
      platform_slug?: string; apartment_name: string
      access_code?: string; access_instructions?: string
      drive_link_photos?: string; address?: string
    }>(
      `SELECT r.guest_name, r.checkin, r.checkout, r.platform_slug,
              a.name AS apartment_name, a.access_code,
              a.access_instructions, a.drive_link_photos, a.address
       FROM reservations r
       JOIN apartments a ON a.id = r.apartment_id
       WHERE r.id = $1 AND a.tenant_id = $2`,
      [reservation_id, tid]
    ),
    query<{ host_name?: string; ton_de_voix?: string; exemple_messages?: string }>(
      'SELECT host_name, ton_de_voix, exemple_messages FROM tenants WHERE id = $1',
      [tid]
    ),
    query<{ early_checkin_from?: string; late_checkout_until?: string; pets_allowed: boolean; extra_notes?: string }>(
      'SELECT early_checkin_from, late_checkout_until, pets_allowed, extra_notes FROM rules WHERE tenant_id = $1',
      [tid]
    ),
  ])

  if (!resvRows.length) return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 })

  const r = resvRows[0]
  const t = tenantRows[0]
  const rules = rulesRows[0] ?? null

  const checkinDate = new Date(r.checkin).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const checkoutDate = new Date(r.checkout).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const nights = Math.round(
    (new Date(r.checkout).getTime() - new Date(r.checkin).getTime()) / 86400000
  )

  const hostName = t?.host_name?.trim() || 'votre hôte'
  const tonDeVoix = t?.ton_de_voix?.trim() || 'chaleureux, accueillant et professionnel'
  const exemples = t?.exemple_messages?.trim() || ''

  const systemPrompt = [
    `Tu es un assistant de conciergerie immobilière. Tu génères des messages de bienvenue personnalisés pour les voyageurs de locations courte durée.`,
    `Ton de voix de l'hôte : ${tonDeVoix}.`,
    `L'hôte se prénomme : ${hostName}.`,
    exemples
      ? `Voici des exemples de messages habituels de l'hôte (inspire-toi du style, pas du contenu) :\n${exemples}`
      : '',
    `Génère UNIQUEMENT le message de bienvenue, sans introduction, commentaire ni explication. Le message doit être naturel et humain.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const accessLines = [
    r.access_code ? `- Code d'accès / interphone : ${r.access_code}` : '',
    r.access_instructions ? `- Instructions d'accès : ${r.access_instructions}` : '',
    r.drive_link_photos ? `- Photos d'accès disponibles : ${r.drive_link_photos}` : '',
  ].filter(Boolean)

  const rulesLines = rules
    ? [
        rules.early_checkin_from ? `- Early check-in possible dès ${rules.early_checkin_from}` : '',
        rules.late_checkout_until ? `- Late check-out possible jusqu'à ${rules.late_checkout_until}` : '',
        rules.pets_allowed ? '- Animaux de compagnie acceptés' : '- Animaux de compagnie non acceptés',
        rules.extra_notes ? `- Notes importantes : ${rules.extra_notes}` : '',
      ].filter(Boolean)
    : []

  const userPrompt = [
    `Génère un message de bienvenue pour ce voyageur :`,
    ``,
    `Voyageur : ${r.guest_name || 'le/la voyageur(se)'}`,
    `Appartement : ${r.apartment_name}${r.address ? ` (${r.address})` : ''}`,
    `Arrivée : ${checkinDate}`,
    `Départ : ${checkoutDate}`,
    `Durée : ${nights} nuit${nights > 1 ? 's' : ''}`,
    r.platform_slug ? `Plateforme : ${r.platform_slug}` : '',
    ``,
    accessLines.length ? `Informations d'accès :\n${accessLines.join('\n')}` : '',
    rulesLines.length ? `Règles :\n${rulesLines.join('\n')}` : '',
    ``,
    `Le message doit :`,
    `1. Commencer par un accueil chaleureux avec le prénom du voyageur`,
    `2. Donner les informations d'accès claires`,
    `3. Mentionner les règles importantes`,
    `4. Inviter le voyageur à contacter l'hôte pour toute question`,
    `5. Terminer chaleureusement avec la signature de l'hôte`,
  ]
    .filter(s => s !== null && s !== undefined)
    .join('\n')

  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const response = await stream.finalMessage()
  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  return NextResponse.json({ message: text })
}

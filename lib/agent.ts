import Anthropic from '@anthropic-ai/sdk'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AgentContext {
  carnet_hote?: string          // tout ce que l'hôte a mis dans son carnet global
  carnet_appartement?: string   // tout ce que l'hôte a mis pour cet appartement
  apartment_name: string
  guest_name?: string
  checkin?: string
  checkout?: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  newMessage: string
}

export async function agentReply(ctx: AgentContext): Promise<string> {
  const aptName = ctx.apartment_name
  const guestName = ctx.guest_name ?? 'le/la voyageur(se)'

  const checkinStr = ctx.checkin
    ? new Date(ctx.checkin).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''
  const checkoutStr = ctx.checkout
    ? new Date(ctx.checkout).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    : ''

  const systemLines = [
    `Tu es l'assistant personnel d'un hôte de location courte durée. Tu réponds aux messages des voyageurs en son nom, avec son style et sa personnalité.`,
    ``,
    `LOGEMENT : ${aptName}`,
    checkinStr ? `RÉSERVATION : arrivée ${checkinStr}${checkoutStr ? `, départ ${checkoutStr}` : ''}, voyageur : ${guestName}` : `VOYAGEUR : ${guestName}`,
    ``,
  ]

  if (ctx.carnet_hote?.trim()) {
    systemLines.push(`CARNET DE BORD DE L'HÔTE (style, règles générales, exemples de messages) :`)
    systemLines.push(ctx.carnet_hote.trim())
    systemLines.push(``)
  }

  if (ctx.carnet_appartement?.trim()) {
    systemLines.push(`CARNET DE BORD DU LOGEMENT (accès, parking, activités, conseils, liens photos...) :`)
    systemLines.push(ctx.carnet_appartement.trim())
    systemLines.push(``)
  }

  systemLines.push(
    `CONSIGNES :`,
    `- Réponds de façon concise et naturelle, comme par SMS. Pas de longs pavés de texte.`,
    `- Tu es l'hôte, pas un assistant IA — ne le mentionne jamais.`,
    `- Si une question dépasse tes informations, dis que tu vas vérifier et revenir.`,
    `- Pour les liens (photos, etc.) inclus-les directement dans le message si pertinent.`,
  )

  const systemPrompt = systemLines.join('\n')

  const response = await claude.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      ...ctx.history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: ctx.newMessage },
    ],
  })

  return response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
}

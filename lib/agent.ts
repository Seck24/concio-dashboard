import Anthropic from '@anthropic-ai/sdk'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AgentContext {
  tenant: {
    host_name?: string
    ton_de_voix?: string
  }
  apartment: {
    name: string
    address?: string
    access_code?: string
    access_instructions?: string
    drive_link_photos?: string
    city_info?: string
    activities_nearby?: string
    parking_tips?: string
  }
  reservation: {
    guest_name?: string
    checkin: string
    checkout: string
  }
  rules?: {
    early_checkin_from?: string
    late_checkout_until?: string
    pets_allowed?: boolean
    extra_notes?: string
  }
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  newMessage: string
}

export async function agentReply(ctx: AgentContext): Promise<string> {
  const hostName = ctx.tenant.host_name?.trim() || 'votre hôte'
  const tone = ctx.tenant.ton_de_voix?.trim() || 'chaleureux, naturel et professionnel'
  const checkin = new Date(ctx.reservation.checkin).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const checkout = new Date(ctx.reservation.checkout).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long',
  })

  const lines = [
    `Tu es l'assistant personnel de ${hostName}, hôte de location courte durée.`,
    `Tu réponds aux messages des voyageurs en son nom, avec son ton et sa personnalité.`,
    `Ton de voix : ${tone}.`,
    ``,
    `LOGEMENT :`,
    `- Nom : ${ctx.apartment.name}`,
    ctx.apartment.address ? `- Adresse : ${ctx.apartment.address}` : '',
    ctx.apartment.access_code ? `- Code d'accès : ${ctx.apartment.access_code}` : '',
    ctx.apartment.access_instructions ? `- Accès : ${ctx.apartment.access_instructions}` : '',
    ctx.apartment.drive_link_photos ? `- Photos d'accès : ${ctx.apartment.drive_link_photos}` : '',
    ctx.apartment.city_info ? `\nVILLE :\n${ctx.apartment.city_info}` : '',
    ctx.apartment.activities_nearby ? `\nACTIVITÉS PROCHES :\n${ctx.apartment.activities_nearby}` : '',
    ctx.apartment.parking_tips ? `\nPARKING :\n${ctx.apartment.parking_tips}` : '',
    ``,
    `RÉSERVATION :`,
    `- Voyageur : ${ctx.reservation.guest_name ?? 'votre voyageur'}`,
    `- Arrivée : ${checkin}`,
    `- Départ : ${checkout}`,
  ]

  if (ctx.rules) {
    lines.push(``, `RÈGLES :`)
    if (ctx.rules.early_checkin_from) lines.push(`- Early check-in dès ${ctx.rules.early_checkin_from}`)
    if (ctx.rules.late_checkout_until) lines.push(`- Late check-out jusqu'à ${ctx.rules.late_checkout_until}`)
    if (ctx.rules.pets_allowed !== undefined) lines.push(`- Animaux : ${ctx.rules.pets_allowed ? 'acceptés' : 'non acceptés'}`)
    if (ctx.rules.extra_notes) lines.push(`- Note : ${ctx.rules.extra_notes}`)
  }

  lines.push(
    ``,
    `CONSIGNES :`,
    `- Réponds de façon concise, naturelle, comme par SMS. Pas de longs pavés.`,
    `- Signe du prénom de l'hôte (${hostName}).`,
    `- Si tu ignores la réponse à une question, dis que tu vas vérifier.`,
    `- Tu ne révèles jamais être un assistant IA.`,
  )

  const systemPrompt = lines.filter(l => l !== null && l !== undefined).join('\n')

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

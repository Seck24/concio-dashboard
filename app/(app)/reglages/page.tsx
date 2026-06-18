'use client'

import { useEffect, useState } from 'react'
import { Settings, User, Plus, Trash2, Save, Bot } from 'lucide-react'

interface Cleaner { id: string; name: string; whatsapp: string }
interface Rules {
  early_checkin_from?: string; early_checkin_fee: number
  late_checkout_until?: string; late_checkout_fee: number
  pets_allowed: boolean; parties_allowed: boolean; extra_notes?: string
}
interface Tenant {
  name: string; email: string; whatsapp?: string; plan: string
  host_name?: string; ton_de_voix?: string; exemple_messages?: string
}
interface AiConfig { host_name: string; ton_de_voix: string; exemple_messages: string }

export default function ReglagesPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [rules, setRules] = useState<Rules | null>(null)
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [tab, setTab] = useState<'profil' | 'regles' | 'prestataires' | 'agent_ia'>('profil')
  const [aiConfig, setAiConfig] = useState<AiConfig>({ host_name: '', ton_de_voix: '', exemple_messages: '' })

  // New cleaner form
  const [newCleaner, setNewCleaner] = useState({ name: '', whatsapp: '' })

  useEffect(() => {
    fetch('/api/reglages').then(r => r.json()).then(d => {
      setTenant(d.tenant)
      setRules(d.rules ?? {
        early_checkin_fee: 0, late_checkout_fee: 0,
        pets_allowed: false, parties_allowed: false,
      })
      setCleaners(d.cleaners ?? [])
      setAiConfig({
        host_name: d.tenant?.host_name ?? '',
        ton_de_voix: d.tenant?.ton_de_voix ?? '',
        exemple_messages: d.tenant?.exemple_messages ?? '',
      })
    })
  }, [])

  async function saveProfile() {
    if (!tenant) return
    setSaving('profil')
    await fetch('/api/reglages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_profile', name: tenant.name, whatsapp: tenant.whatsapp }),
    })
    setSaving(null)
  }

  async function saveRules() {
    if (!rules) return
    setSaving('regles')
    await fetch('/api/reglages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_rules', ...rules }),
    })
    setSaving(null)
  }

  async function addCleaner() {
    if (!newCleaner.name || !newCleaner.whatsapp) return
    setSaving('cleaner')
    const res = await fetch('/api/reglages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_cleaner', ...newCleaner }),
    })
    const data = await res.json()
    if (res.ok) {
      setCleaners(prev => [...prev, { id: data.id, ...newCleaner }])
      setNewCleaner({ name: '', whatsapp: '' })
    }
    setSaving(null)
  }

  async function saveAiConfig() {
    setSaving('ai')
    await fetch('/api/reglages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_ai_config', ...aiConfig }),
    })
    setSaving(null)
  }

  async function removeCleaner(id: string) {
    await fetch('/api/reglages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_cleaner', id }),
    })
    setCleaners(prev => prev.filter(c => c.id !== id))
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Réglages</h1><div className="sub">Configuration de votre espace Concio</div></div>
      </div>
      <div className="mobile-topbar">
        <div><h1>Réglages</h1></div>
      </div>

      <div className="page-body">
        <div className="tabs">
          {[
            { key: 'profil',        label: 'Profil' },
            { key: 'regles',        label: 'Règles tarifaires' },
            { key: 'prestataires',  label: 'Prestataires' },
            { key: 'agent_ia',      label: '✦ Agent IA' },
          ].map(t => (
            <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key as typeof tab)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* PROFIL */}
        {tab === 'profil' && tenant && (
          <div className="panel" style={{ maxWidth: 560 }}>
            <div className="panel-h"><h3>Informations du compte</h3></div>
            <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nom / Raison sociale</label>
                <input className="form-input" value={tenant.name} onChange={e => setTenant(p => p && ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={tenant.email} disabled style={{ opacity: .6 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Numéro WhatsApp (notifications)</label>
                <input className="form-input" placeholder="+225 07 00 00 00 00" value={tenant.whatsapp ?? ''} onChange={e => setTenant(p => p && ({ ...p, whatsapp: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={saveProfile} disabled={saving === 'profil'}>
                  <Save size={15} /> {saving === 'profil' ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
              <div className="divider"></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--slate)' }}>Plan actuel</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>
                    {tenant.plan === 'trial' ? 'Essai gratuit' : tenant.plan}
                  </div>
                </div>
                {tenant.plan === 'trial' && (
                  <span className="badge badge-amber">Essai</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RÈGLES */}
        {tab === 'regles' && rules && (
          <div className="panel" style={{ maxWidth: 560 }}>
            <div className="panel-h"><h3>Early check-in & Late check-out</h3></div>
            <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Early check-in dès</label>
                  <input className="form-input" type="time" value={rules.early_checkin_from ?? ''} onChange={e => setRules(p => p && ({ ...p, early_checkin_from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Supplément (€)</label>
                  <input className="form-input" type="number" min="0" step="5" value={rules.early_checkin_fee} onChange={e => setRules(p => p && ({ ...p, early_checkin_fee: parseFloat(e.target.value) }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Late check-out jusqu'à</label>
                  <input className="form-input" type="time" value={rules.late_checkout_until ?? ''} onChange={e => setRules(p => p && ({ ...p, late_checkout_until: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Supplément (€)</label>
                  <input className="form-input" type="number" min="0" step="5" value={rules.late_checkout_fee} onChange={e => setRules(p => p && ({ ...p, late_checkout_fee: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div className="divider"></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'pets_allowed' as const, label: 'Animaux autorisés' },
                  { key: 'parties_allowed' as const, label: 'Fêtes autorisées' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: 'var(--slate)', fontWeight: 500 }}>{label}</span>
                    <div
                      className={`switch${rules[key] ? ' on' : ''}`}
                      onClick={() => setRules(p => p && ({ ...p, [key]: !p[key] }))}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notes supplémentaires</label>
                <textarea className="form-input" rows={3} placeholder="Ex: Pas de fumée dans l'appartement." value={rules.extra_notes ?? ''} onChange={e => setRules(p => p && ({ ...p, extra_notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={saveRules} disabled={saving === 'regles'}>
                  <Save size={15} /> {saving === 'regles' ? 'Enregistrement…' : 'Enregistrer les règles'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AGENT IA */}
        {tab === 'agent_ia' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
            <div className="panel">
              <div className="panel-h" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bot size={18} style={{ color: 'var(--blue)' }} />
                <h3>Configuration de l'agent IA</h3>
              </div>
              <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0 }}>
                  L'agent IA utilise ces informations pour générer des messages de bienvenue personnalisés pour chaque voyageur.
                </p>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Votre prénom (affiché aux voyageurs)</label>
                  <input
                    className="form-input"
                    placeholder="Ex: Sophie"
                    value={aiConfig.host_name}
                    onChange={e => setAiConfig(p => ({ ...p, host_name: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ton de voix</label>
                  <input
                    className="form-input"
                    placeholder="Ex: chaleureux et professionnel, comme un ami qui accueille"
                    value={aiConfig.ton_de_voix}
                    onChange={e => setAiConfig(p => ({ ...p, ton_de_voix: e.target.value }))}
                  />
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    Décrivez votre style de communication pour que l'IA s'adapte à votre personnalité.
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Exemples de vos messages habituels</label>
                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder="Collez ici 1 à 3 exemples de messages de bienvenue que vous envoyez habituellement à vos voyageurs. L'IA s'en inspirera pour reproduire votre style."
                    value={aiConfig.exemple_messages}
                    onChange={e => setAiConfig(p => ({ ...p, exemple_messages: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={saveAiConfig} disabled={saving === 'ai'}>
                    <Save size={15} /> {saving === 'ai' ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRESTATAIRES */}
        {tab === 'prestataires' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
            <div className="panel">
              <div className="panel-h"><h3>Ajouter un prestataire</h3></div>
              <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Prénom / Nom</label>
                  <input className="form-input" placeholder="Marie Koné" value={newCleaner.name} onChange={e => setNewCleaner(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Numéro WhatsApp</label>
                  <input className="form-input" placeholder="+225 07 00 00 00 00" value={newCleaner.whatsapp} onChange={e => setNewCleaner(p => ({ ...p, whatsapp: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={addCleaner} disabled={saving === 'cleaner' || !newCleaner.name || !newCleaner.whatsapp}>
                    <Plus size={15} /> {saving === 'cleaner' ? 'Ajout…' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </div>

            {cleaners.length > 0 ? (
              <div className="panel">
                <div className="panel-h"><h3>Prestataires actifs ({cleaners.length})</h3></div>
                <div className="panel-b" style={{ padding: 0 }}>
                  {cleaners.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 18px', borderBottom: '1px solid var(--line-2)',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 999, background: 'var(--blue)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, color: '#fff', fontSize: 14, flexShrink: 0,
                      }}>
                        {c.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--slate)' }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{c.whatsapp}</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)' }} onClick={() => removeCleaner(c.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ paddingTop: 20 }}>
                <User size={28} /><h3>Aucun prestataire</h3><p>Ajoutez vos prestataires ménage ci-dessus.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

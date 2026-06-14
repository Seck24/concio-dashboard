'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Building2, Calendar, MessageSquare } from 'lucide-react'

interface Apt {
  id: string; name: string; address?: string;
  platforms: { slug: string; name: string; color: string }[]
  current_guest?: string; current_checkout?: string
  next_guest?: string; next_checkin?: string
}

const PLAT_LETTER: Record<string, string> = { airbnb: 'A', booking: 'B', vrbo: 'V', leboncoin: 'L' }
const PLAT_CLASS: Record<string, string> = { airbnb: 'plat-air', booking: 'plat-book', vrbo: 'plat-vrbo', leboncoin: 'plat-lbc' }

const EMOJIS = ['🏠','🏡','🏢','🏩','🛋️','🌆','🌃','🏙️']

export default function ApartmentsPage() {
  const router = useRouter()
  const [apartments, setApartments] = useState<Apt[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'tous' | 'occupe' | 'libre' | 'alerte'>('tous')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', expected_cleaning_min: '90' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/apartments')
      .then(r => r.json())
      .then(d => { setApartments(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const filtered = apartments.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'occupe' && !a.current_guest) return false
    if (filter === 'libre' && a.current_guest) return false
    return true
  })

  async function createApt() {
    if (!form.name) return
    setSaving(true)
    const res = await fetch('/api/apartments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, expected_cleaning_min: parseInt(form.expected_cleaning_min) }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setShowModal(false)
      setForm({ name: '', address: '', expected_cleaning_min: '90' })
      router.push(`/apartments/${data.id}`)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Appartements</h1>
          <div className="sub">{apartments.length} appartement{apartments.length > 1 ? 's' : ''} actif{apartments.length > 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Ajouter
        </button>
      </div>
      <div className="mobile-topbar">
        <div><h1>Appartements</h1><div className="sub">{apartments.length} actif{apartments.length > 1 ? 's' : ''}</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /></button>
      </div>

      <div className="page-body">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Rechercher un appartement…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="chips">
          {(['tous','occupe','libre'] as const).map(f => (
            <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'tous' ? 'Tous' : f === 'occupe' ? 'Occupés' : 'Libres'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state"><Building2 size={32} /><h3>Chargement…</h3></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Building2 size={32} />
            <h3>{apartments.length === 0 ? 'Aucun appartement encore' : 'Aucun résultat'}</h3>
            <p>{apartments.length === 0 ? 'Ajoutez votre premier appartement pour commencer.' : 'Modifiez votre recherche.'}</p>
            {apartments.length === 0 && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
                <Plus size={15} /> Ajouter un appartement
              </button>
            )}
          </div>
        ) : (
          <div className="apt-grid">
            {filtered.map((a, idx) => (
              <div key={a.id} className="apt-card" onClick={() => router.push(`/apartments/${a.id}`)}>
                <div className="apt-photo">
                  <span style={{ fontSize: 36 }}>{EMOJIS[idx % EMOJIS.length]}</span>
                </div>
                <div className="apt-body">
                  <div className="apt-name">{a.name}</div>
                  <div style={{ marginBottom: 4 }}>
                    {a.current_guest
                      ? <span className="badge badge-blue">Occupé</span>
                      : a.next_guest
                        ? <span className="badge badge-amber">Arrivée imminente</span>
                        : <span className="badge badge-green">Libre</span>
                    }
                  </div>
                  <div className="apt-next" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    {a.current_guest
                      ? `🔑 ${a.current_guest}`
                      : a.next_guest
                        ? `Prochain: ${a.next_guest}`
                        : 'Aucune réservation à venir'
                    }
                  </div>
                  {a.platforms?.length > 0 && (
                    <div className="apt-plats">
                      {a.platforms.map(p => (
                        <span key={p.slug} className={`plat ${PLAT_CLASS[p.slug] ?? ''}`}>
                          {PLAT_LETTER[p.slug] ?? p.slug[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add apartment modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: '28px 24px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate)', marginBottom: 20 }}>
              Nouvel appartement
            </h2>
            <div className="form-group">
              <label className="form-label">Nom de l'appartement *</label>
              <input className="form-input" placeholder="Ex: Bastille Studio" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Adresse</label>
              <input className="form-input" placeholder="12 rue de la Paix, Paris" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Durée de ménage prévue (min)</label>
              <input className="form-input" type="number" min="30" max="300" value={form.expected_cleaning_min} onChange={e => setForm(p => ({ ...p, expected_cleaning_min: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={createApt} disabled={saving || !form.name}>
                {saving ? 'Création…' : 'Créer l\'appartement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

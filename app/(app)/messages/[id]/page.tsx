'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, Bot, Check, RotateCcw, Edit2, X } from 'lucide-react'

interface Message { id: string; role: string; content: string; status: string; sent_at: string }
interface Conv { id: string; guest_name?: string; guest_phone: string; apartment_name?: string; status: string }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [conv, setConv] = useState<Conv | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')

  // Revision modal state
  const [revising, setRevising] = useState<string | null>(null) // message_id being revised
  const [reviseInstruction, setReviseInstruction] = useState('')
  const [reviseLoading, setReviseLoading] = useState(false)

  // Edit draft inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/agent/conversations/${id}`)
      .then(r => r.json())
      .then(d => { setConv(d.conversation); setMessages(d.messages ?? []); setLoading(false) })
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendDraft(msgId: string, content?: string) {
    // If editing, update content first
    if (content !== undefined) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content } : m))
    }
    setSending(true)
    try {
      await fetch(`/api/agent/conversations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', message_id: msgId }),
      })
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m))
      setEditingId(null)
    } finally {
      setSending(false)
    }
  }

  async function reviseDraft(msgId: string) {
    if (!reviseInstruction.trim()) return
    setReviseLoading(true)
    try {
      const res = await fetch(`/api/agent/conversations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revise', message_id: msgId, instruction: reviseInstruction }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.content } : m))
        setRevising(null)
        setReviseInstruction('')
      }
    } finally {
      setReviseLoading(false)
    }
  }

  async function sendManual() {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await fetch(`/api/agent/conversations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_manual', content: text }),
      })
      if (res.ok) {
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString(), role: 'assistant', content: text, status: 'sent', sent_at: new Date().toISOString() },
        ])
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="page-body" style={{ paddingTop: 40 }}>
        <div className="empty-state"><Bot size={32} /><h3>Chargement…</h3></div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
        borderBottom: '1px solid var(--line)', background: 'var(--surface)', flexShrink: 0,
      }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: '6px 0' }} onClick={() => router.push('/messages')}>
          <ArrowLeft size={16} />
        </button>
        <div style={{
          width: 38, height: 38, borderRadius: 999, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--slate-600), var(--blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: '#fff', fontSize: 15,
        }}>
          {(conv?.guest_name ?? '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--slate)' }}>
            {conv?.guest_name ?? conv?.guest_phone}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {conv?.apartment_name ?? ''} · {conv?.guest_phone}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 16px',
        display: 'flex', flexDirection: 'column', gap: 14,
        background: 'var(--surface-2)',
      }}>
        {messages.map(m => {
          const isDraft = m.status === 'draft'
          const isEditing = editingId === m.id

          if (m.role === 'user') {
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', background: 'var(--surface)',
                  border: '1px solid var(--line)', borderRadius: '4px 16px 16px 16px',
                  padding: '10px 14px', fontSize: 13.5, lineHeight: 1.55,
                  color: 'var(--slate)', whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>{fmtTime(m.sent_at)}</div>
                </div>
              </div>
            )
          }

          // Assistant message (sent or draft)
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{
                maxWidth: '80%',
                background: isDraft ? 'var(--surface)' : 'var(--blue)',
                color: isDraft ? 'var(--slate)' : '#fff',
                border: isDraft ? '2px dashed var(--blue)' : 'none',
                borderRadius: isDraft ? '16px 4px 16px 16px' : '16px 4px 16px 16px',
                padding: '10px 14px', fontSize: 13.5, lineHeight: 1.55,
                whiteSpace: 'pre-wrap', width: isDraft ? '100%' : undefined,
              }}>
                {isDraft && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Bot size={11} /> BROUILLON — à valider avant envoi
                  </div>
                )}

                {isEditing ? (
                  <textarea
                    autoFocus
                    className="form-input"
                    rows={6}
                    style={{ width: '100%', fontSize: 13.5, lineHeight: 1.55, resize: 'vertical' }}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                ) : (
                  <div>{m.content}</div>
                )}

                <div style={{ fontSize: 10.5, color: isDraft ? 'var(--ink-3)' : 'rgba(255,255,255,.6)', marginTop: 4 }}>
                  {fmtTime(m.sent_at)} {!isDraft && '· Envoyé'}
                </div>
              </div>

              {/* Draft actions */}
              {isDraft && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {isEditing ? (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                        <X size={13} /> Annuler
                      </button>
                      <button className="btn btn-primary btn-sm" disabled={sending} onClick={() => sendDraft(m.id, editContent)}>
                        <Check size={13} /> Envoyer cette version
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(m.id); setEditContent(m.content) }}>
                        <Edit2 size={13} /> Modifier
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setRevising(m.id); setReviseInstruction('') }}>
                        <RotateCcw size={13} /> Demander révision
                      </button>
                      <button className="btn btn-primary btn-sm" disabled={sending} onClick={() => sendDraft(m.id)}>
                        <Check size={13} /> Envoyer
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Revision modal */}
      {revising && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16,
        }} onClick={e => { if (e.target === e.currentTarget) setRevising(null) }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 540,
            padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: '0 -4px 30px rgba(0,0,0,.15)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--slate)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={16} style={{ color: 'var(--blue)' }} />
              Demander une révision à l'agent
            </div>
            <textarea
              autoFocus
              className="form-input"
              rows={3}
              placeholder="Ex: Rends le message plus court. / Ajoute les infos sur le parking. / Utilise un ton plus formel."
              value={reviseInstruction}
              onChange={e => setReviseInstruction(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setRevising(null)}>Annuler</button>
              <button className="btn btn-primary" disabled={!reviseInstruction.trim() || reviseLoading} onClick={() => reviseDraft(revising)}>
                {reviseLoading ? 'Révision en cours…' : 'Réviser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input — message manuel */}
      <div style={{
        borderTop: '1px solid var(--line)', padding: '12px 16px',
        background: 'var(--surface)', flexShrink: 0,
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <textarea
          className="form-input"
          rows={2}
          style={{ flex: 1, resize: 'none', fontSize: 13.5 }}
          placeholder="Message manuel (envoyé directement sans validation)…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendManual() } }}
        />
        <button
          className="btn btn-primary"
          style={{ padding: '10px 14px', flexShrink: 0 }}
          onClick={sendManual}
          disabled={!input.trim() || sending}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

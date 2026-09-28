import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import { useStore } from '../store'
import { api } from '../api'
import { Proposal } from '../../../shared/types'

marked.setOptions({ breaks: true, async: false })

function renderMd(text: string): string {
  return marked.parse(text.replace(/<script[\s\S]*?<\/script>/gi, '')) as string
}

function opSummary(p: Proposal, nameOf: (id: string) => string): { sign: '+' | '~' | '-'; label: string; kind: string }[] {
  return p.ops.map((op) => {
    if (op.op === 'create_node') return { sign: '+' as const, label: `Componente ${op.node.name} (${op.node.type ?? 'generic'})`, kind: op.op }
    if (op.op === 'update_node') return { sign: '~' as const, label: `Aggiorna ${nameOf(op.id)}`, kind: op.op }
    if (op.op === 'delete_node') return { sign: '-' as const, label: `Elimina ${nameOf(op.id)}`, kind: op.op }
    if (op.op === 'create_relation')
      return { sign: '+' as const, label: `Relazione ${nameOf(op.relation.sourceId)} → ${nameOf(op.relation.targetId)} (${op.relation.type})`, kind: op.op }
    if (op.op === 'update_relation') return { sign: '~' as const, label: `Aggiorna relazione`, kind: op.op }
    if (op.op === 'delete_relation') return { sign: '-' as const, label: `Elimina relazione`, kind: op.op }
    if (op.op === 'create_group') return { sign: '+' as const, label: `Gruppo ${op.group.name}`, kind: op.op }
    if (op.op === 'create_artifact') return { sign: '+' as const, label: `Artefatto «${op.artifact.title}» (${op.artifact.category})`, kind: op.op }
    if (op.op === 'update_artifact') return { sign: '~' as const, label: `Aggiorna artefatto`, kind: op.op }
    if (op.op === 'delete_artifact') return { sign: '-' as const, label: `Elimina artefatto`, kind: op.op }
    return { sign: '~' as const, label: op.op, kind: op.op }
  })
}

export function ProposalCard({
  proposal,
  status,
  onVote
}: {
  proposal: Proposal
  status: 'pending' | 'approved' | 'rejected'
  onVote: (v: 'approved' | 'rejected') => void
}) {
  const data = useStore((s) => s.data)
  const nameOf = (id: string) => data?.model.nodes.find((n) => n.id === id)?.name ?? id
  const ops = opSummary(proposal, nameOf)
  return (
    <div className="proposal">
      <div className="p-title">{proposal.title}</div>
      {proposal.summary && <div className="p-summary">{proposal.summary}</div>}
      <div className="p-ops">
        {ops.map((o, i) => (
          <div key={i} className={`p-op ${o.sign === '+' ? 'add' : o.sign === '~' ? 'mod' : 'del'}`}>
            <span className="sign">{o.sign}</span>
            <span>{o.label}</span>
          </div>
        ))}
      </div>
      {status === 'pending' ? (
        <div className="p-actions">
          <button className="small primary" onClick={() => onVote('approved')}>Approva</button>
          <button className="small" onClick={() => onVote('rejected')}>Rifiuta</button>
        </div>
      ) : (
        <div className="p-status">{status === 'approved' ? 'Applicata' : 'Rifiutata'}</div>
      )}
    </div>
  )
}

export function ChatPanel() {
  const chatOpen = useStore((s) => s.chatOpen)
  const chatHeight = useStore((s) => s.chatHeight)
  const messages = useStore((s) => s.chatMessages)
  const busy = useStore((s) => s.chatBusy)
  const selection = useStore((s) => s.selection)
  const data = useStore((s) => s.data)
  const settings = useStore((s) => s.settings)
  const sendChat = useStore((s) => s.sendChat)
  const voteAi = useStore((s) => s.voteAiProposal)
  const setChatOpen = useStore((s) => s.setChatOpen)
  const setChatHeight = useStore((s) => s.setChatHeight)
  const [text, setText] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const resizeState = useRef<{ startY: number; startH: number } | null>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, busy, messages[messages.length - 1]?.content.length])

  // framimenti in streaming dal main process
  useEffect(() => {
    return api.events.onAiDelta((delta) => {
      useStore.getState().appendChatDelta(delta)
    })
  }, [])

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!resizeState.current) return
      setChatHeight(resizeState.current.startH - (e.clientY - resizeState.current.startY))
    }
    const up = () => {
      resizeState.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [setChatHeight])

  if (!chatOpen) {
    return (
      <div className="chat-panel" style={{ height: 37 }}>
        <div
          className="chat-head"
          style={{ cursor: 'pointer' }}
          onClick={() => setChatOpen(true)}
        >
          <span className="title">Architetto AI</span>
          <span className="model">{settings?.ai.model}</span>
          <span style={{ flex: 1 }} />
          <span className="model">apri</span>
        </div>
      </div>
    )
  }

  const send = () => {
    const t = text
    setText('')
    void sendChat(t)
  }

  const selNames = selection.nodeIds
    .map((id) => data?.model.nodes.find((n) => n.id === id)?.name)
    .filter(Boolean)
  const aiConfigured = settings?.ai.baseUrl && (settings.ai.apiKey || settings.ai.baseUrl.includes('localhost'))

  return (
    <div className="chat-panel" style={{ height: chatHeight }}>
      <div
        className="chat-resizer"
        onMouseDown={(e) => {
          resizeState.current = { startY: e.clientY, startH: chatHeight }
          document.body.style.cursor = 'ns-resize'
        }}
      />
      <div className="chat-head">
        <span className="title">Architetto AI</span>
        <span className="model">{settings?.ai.model ?? 'not configured'}</span>
        <span style={{ flex: 1 }} />
        <button className="small ghost" onClick={() => setChatOpen(false)}>nascondi</button>
      </div>
      {selNames.length > 0 && (
        <div className="chat-context-chip">
          Contesto: <span className="chip">{selNames.join(', ')} + connessioni</span>
        </div>
      )}
      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 && (
          <div className="chat-quick">
            <button className="chip clickable" onClick={() => void sendChat('Aggiungi un Redis cache tra API e Worker')}>
              + Aggiungi un Redis tra API e Worker
            </button>
            <button className="chip clickable" onClick={() => void sendChat('Analizza l\'architettura attuale: punti deboli e migliorie?')}>
              Analizza l'architettura
            </button>
            <button className="chip clickable" onClick={() => void sendChat('Genera la specifica API del componente selezionato o della API principale')}>
              Genera una specifica API
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="empty-hint">
            {aiConfigured ? (
              <>
                Descrivi il sistema che vuoi progettare o fai una domanda sull'architettura corrente.
                <br />
                Esempi: «Aggiungi un Redis tra API e Worker» · «Questo servizio è troppo accoppiato?» · «Genera la specifica API del componente selezionato»
              </>
            ) : (
              <>
                Configura un provider AI nelle Impostazioni (OpenAI, Ollama, OpenRouter o qualsiasi endpoint OpenAI-compatible) per attivare l'Architetto AI.
              </>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`msg ${m.role}${m.isError ? ' error' : ''}`}
            onContextMenu={(e) => {
              e.preventDefault()
              void api.ctx.show([{ id: 'copy', label: 'Copy Message' }]).then((id) => {
                if (id === 'copy')
                  void navigator.clipboard.writeText(m.content + (m.proposal ? `\n\n[Proposal: ${m.proposal.title}]` : ''))
              })
            }}
          >
            <div className="role-tag">{m.role}</div>
            {m.role === 'assistant' ? (
              <>
                <div dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />
                {m.streaming && <span className="stream-cursor" />}{' '}
              </>
            ) : (
              m.content
            )}
            {m.proposal && (
              <div style={{ marginTop: 8 }}>
                <ProposalCard proposal={m.proposal} status={m.proposalStatus ?? 'pending'} onVote={(v) => voteAi(m.id, v)} />
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ alignSelf: 'flex-start', padding: '4px 8px' }}><span className="spinner" /> sta pensando…</div>}
      </div>
      <div className="chat-input-row">
        <textarea
          placeholder="Chiedi all'Architetto AI… (Invio per inviare, Shift+Invio per andare a capo)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button className="primary" disabled={busy || !text.trim()} onClick={send}>
          Invia
        </button>
      </div>
    </div>
  )
}

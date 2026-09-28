import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useStore } from '../store'
import { NODE_CATEGORIES, RELATION_TYPES } from '../../../shared/types'
import { techInfo } from '../../../shared/tech'
import { techColor, techLabel } from '../icons'
import { TechPicker } from './TechPicker'
import { nodeIcon, CATEGORY_COLORS, relationColor } from '../icons'

export function Inspector() {
  const data = useStore((s) => s.data)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const focusNode = useStore((s) => s.focusNode)
  const applyOps = useStore((s) => s.applyOps)
  const openArtifact = useStore((s) => s.openArtifact)
  const issues = useStore((s) => s.issues)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerFromStore = useStore((s) => s.techPickerNodeId)

  const model = data?.model

  // reset local drafts when selection changes
  useEffect(() => {
    setDraft({})
  }, [selection.nodeIds.join(','), selection.relationIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!model) return <div className="inspector" />

  const node = selection.nodeIds.length === 1 ? model.nodes.find((n) => n.id === selection.nodeIds[0]) : undefined
  const multiNodes = selection.nodeIds.length > 1
  const relation = selection.relationIds.length === 1 ? model.relations.find((r) => r.id === selection.relationIds[0]) : undefined
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name ?? '?'

  const commitField = (nodeId: string, field: string, value: string) => {
    const patch: Record<string, unknown> =
      field === 'responsibilities' ? { responsibilities: value.split('\n').filter((x) => x.trim()) } : { [field]: value }
    void applyOps([{ op: 'update_node', id: nodeId, patch } as never])
  }

  if (relation) {
    const rel = relation
    return (
      <div className="inspector">
        <h3>Relazione</h3>
        <label>Tipo</label>
        <select
          value={rel.type}
          onChange={(e) => void applyOps([{ op: 'update_relation', id: rel.id, patch: { type: e.target.value } }])}
        >
          {[...new Set([...RELATION_TYPES, rel.type])].map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
        <label>Direzione</label>
        <select
          value={rel.direction}
          onChange={(e) =>
            void applyOps([
              { op: 'update_relation', id: rel.id, patch: { direction: e.target.value as 'one-way' | 'two-way' } }
            ])
          }
        >
          <option value="one-way">una direzione</option>
          <option value="two-way">bidirezionale</option>
        </select>
        <label>Protocollo</label>
        <input
          defaultValue={rel.protocol}
          onBlur={(e) => e.target.value !== rel.protocol && void applyOps([{ op: 'update_relation', id: rel.id, patch: { protocol: e.target.value } }])}
        />
        <label>Payload</label>
        <input
          defaultValue={rel.payload}
          onBlur={(e) => e.target.value !== rel.payload && void applyOps([{ op: 'update_relation', id: rel.id, patch: { payload: e.target.value } }])}
        />
        <label>Descrizione</label>
        <textarea
          rows={3}
          defaultValue={rel.description}
          onBlur={(e) => e.target.value !== rel.description && void applyOps([{ op: 'update_relation', id: rel.id, patch: { description: e.target.value } }])}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="small" onClick={() => void applyOps([{ op: 'update_relation', id: rel.id, patch: { sourceId: rel.targetId, targetId: rel.sourceId } }])}>
            Inverti direzione
          </button>
          <button className="small danger" onClick={() => { void applyOps([{ op: 'delete_relation', id: rel.id }]); select([]) }}>
            Elimina
          </button>
        </div>
      </div>
    )
  }

  if (multiNodes) {
    return (
      <div className="inspector">
        <h3>{selection.nodeIds.length} componenti selezionati</h3>
        <div className="empty-hint">
          {selection.nodeIds.map((id) => nameOf(id)).join(', ')}
        </div>
        <button
          className="small danger"
          onClick={() => {
            void applyOps(selection.nodeIds.map((id) => ({ op: 'delete_node', id })))
            select([])
          }}
        >
          Elimina selezione
        </button>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="inspector inspector-idle">
        <div className="idle-icon">{nodeIcon('generic')}</div>
        <div className="idle-title">Nessuna selezione</div>
        <div className="idle-text">
          Click su un componente per i dettagli · doppio click per la scheda completa · trascina tra due nodi per collegarli
        </div>
        <div className="idle-actions">
          <button className="small" onClick={() => void useStore.getState().generateArtifact('system')}>Specifica di sistema</button>
          <button className="small" onClick={() => { void useStore.getState().runValidation(); useStore.getState().setView({ kind: 'validation' }) }}>Valida</button>
        </div>
      </div>
    )
  }

  const inRels = model.relations.filter((r) => r.targetId === node.id)
  const outRels = model.relations.filter((r) => r.sourceId === node.id)
  const linkedArtifacts = model.artifacts.filter((a) => a.nodeIds.includes(node.id))
  const nodeIssues = issues.filter((i) => i.nodeIds?.includes(node.id))
  const catColor = CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.generic

  return (
    <div className="inspector" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <button
          className="icon-tile"
          style={{ width: 30, height: 30, borderRadius: 8, background: `${catColor}22`, color: catColor, border: 'none', cursor: 'zoom-in' }}
          title="Apri la vista dettaglio (doppio click sul nodo)"
          onClick={() => useStore.getState().openDetail(node.id)}
        >
          {nodeIcon(node.type)}
        </button>
        <input
          style={{ fontWeight: 700, fontSize: 14, borderColor: 'transparent', background: 'transparent' }}
          value={draft.name ?? node.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onBlur={(e) => e.target.value !== node.name && commitField(node.id, 'name', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>

      <label>Tipo</label>
      <button className="tech-current" onClick={() => setPickerOpen(true)} title="Scegli tecnologia…">
        <span className="tech-icon" style={{ color: techColor(node.type, node.category) }}>{nodeIcon(node.type)}</span>
        <span>{techLabel(node.type)}</span>
        <span style={{ flex: 1 }} />
        <span className="tech-cat">{techInfo(node.type).category}</span>
      </button>
      {(pickerOpen || pickerFromStore === node.id) && (
        <TechPicker
          value={node.type}
          onSelect={(t) => {
            setPickerOpen(false)
            useStore.setState({ techPickerNodeId: null })
            commitField(node.id, 'type', t)
          }}
          onClose={() => {
            setPickerOpen(false)
            useStore.setState({ techPickerNodeId: null })
          }}
        />
      )}

      <label>Category</label>
      <select value={node.category} onChange={(e) => commitField(node.id, 'category', e.target.value)}>
        {NODE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <label>Tecnologia</label>
      <input
        value={draft.technology ?? node.technology}
        onChange={(e) => setDraft((d) => ({ ...d, technology: e.target.value }))}
        onBlur={(e) => e.target.value !== node.technology && commitField(node.id, 'technology', e.target.value)}
        placeholder="es. Node.js, PostgreSQL 16"
      />

      <label>Descrizione</label>
      <textarea
        rows={3}
        value={draft.description ?? node.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        onBlur={(e) => e.target.value !== node.description && commitField(node.id, 'description', e.target.value)}
      />

      <label>Responsabilità (una per riga)</label>
      <textarea
        rows={4}
        value={draft.responsibilities ?? node.responsibilities.join('\n')}
        onChange={(e) => setDraft((d) => ({ ...d, responsibilities: e.target.value }))}
        onBlur={(e) => e.target.value !== node.responsibilities.join('\n') && commitField(node.id, 'responsibilities', e.target.value)}
      />

      <label>Tags</label>
      <input
        value={draft.tags ?? node.tags.join(', ')}
        onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
        onBlur={(e) => e.target.value !== node.tags.join(', ') && commitField(node.id, 'tags', e.target.value)}
        placeholder="separati da virgola"
      />

      <label>Gruppo</label>
      <select
        value={node.groupId ?? ''}
        onChange={(e) => void applyOps([{ op: 'update_node', id: node.id, patch: { groupId: e.target.value || null } }])}
      >
        <option value="">— nessuno —</option>
        {model.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>

      <button
        className="small"
        style={{ marginTop: 12 }}
        title="Mostra solo la rete di questo componente e i suoi sotto-componenti (tasto E)"
        onClick={() => useStore.getState().expandNode(node.id)}
      >
        Espandi sotto-grafo (E)
      </button>

      <div className="section-title">Relazioni</div>
      {inRels.map((r) => (
        <div key={r.id} className="rel-row" onClick={() => select([], [r.id])}>
          <span style={{ color: relationColor(r.type), fontFamily: 'var(--mono)', fontSize: 10 }}>←{r.type}</span>
          <span>{nameOf(r.sourceId)}</span>
        </div>
      ))}
      {outRels.map((r) => (
        <div key={r.id} className="rel-row" onClick={() => select([], [r.id])}>
          <span style={{ color: relationColor(r.type), fontFamily: 'var(--mono)', fontSize: 10 }}>{r.type}→</span>
          <span>{nameOf(r.targetId)}</span>
        </div>
      ))}
      {inRels.length + outRels.length === 0 && <div className="empty-hint">Nessuna relazione</div>}

      <div className="section-title">Artefatti</div>
      <div>
        {linkedArtifacts.map((a) => (
          <span key={a.id} className="chip clickable" onClick={() => openArtifact(a.id)}>{a.title}</span>
        ))}
        <span className="chip clickable" onClick={() => void useStore.getState().generateArtifact('component', node.id)}>+ Specifica componente</span>
        <span className="chip clickable" onClick={() => void useStore.getState().generateArtifact('api', node.id)}>+ Specifica API</span>
      </div>

      {nodeIssues.length > 0 && (
        <>
          <div className="section-title">Problemi</div>
          {nodeIssues.map((i) => (
            <div key={i.id} style={{ fontSize: 11.5, color: i.severity === 'error' ? 'var(--error)' : 'var(--warn)', marginBottom: 6 }}>
              {i.message}
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button className="small danger" onClick={() => { void applyOps([{ op: 'delete_node', id: node.id }]); select([]) }}>
          Elimina componente
        </button>
      </div>
    </div>
  )
}

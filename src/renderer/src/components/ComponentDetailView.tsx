import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { NODE_CATEGORIES, NodeCategory } from '../../../shared/types'
import { techInfo } from '../../../shared/tech'
import { nodeIcon, techColor } from '../icons'

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  data: 'Dati',
  infrastructure: 'Infrastruttura',
  external: 'Esterno',
  ai: 'AI',
  generic: 'Generico'
}

function RelTable({
  model,
  nodeId,
  dir
}: {
  model: NonNullable<ReturnType<typeof useStore.getState>['data']>['model']
  nodeId: string
  dir: 'in' | 'out'
}) {
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)
  const rows = model.relations.filter((r) => (dir === 'in' ? r.targetId === nodeId : r.sourceId === nodeId))
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name ?? '?'

  if (rows.length === 0) return <div className="detail-empty">Nessuna interfaccia in {dir === 'in' ? 'ingresso' : 'uscita'}.</div>

  return (
    <table className="detail-table">
      <thead>
        <tr>
          <th>{dir === 'in' ? 'Da' : 'Verso'}</th>
          <th>Tipo</th>
          <th>Protocollo</th>
          <th>Payload / Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            className="clickable"
            title="Apri la relazione sulla canvas"
            onClick={() => {
              select([], [r.id])
              setView({ kind: 'canvas' })
            }}
          >
            <td>{nameOf(dir === 'in' ? r.sourceId : r.targetId)}</td>
            <td>{r.type}{r.direction === 'two-way' ? ' ⇄' : ''}</td>
            <td>{r.protocol || '—'}</td>
            <td>{r.payload || r.description || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Editor delle proprietà custom (chiave → valore) del componente. */
function PropertiesEditor({ nodeId, properties }: { nodeId: string; properties: Record<string, string> }) {
  const applyOps = useStore((s) => s.applyOps)
  const [rows, setRows] = useState<[string, string][]>(Object.entries(properties))

  useEffect(() => {
    setRows(Object.entries(properties))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, JSON.stringify(properties)])

  const commit = (next: [string, string][]) => {
    const cleaned: Record<string, string> = {}
    for (const [k, v] of next) {
      const key = k.trim()
      if (key) cleaned[key] = v
    }
    void applyOps([{ op: 'update_node', id: nodeId, patch: { properties: cleaned } }])
  }

  const setRow = (i: number, key: string, value: string) => {
    const next = rows.map((r, j) => (j === i ? ([key, value] as [string, string]) : r))
    setRows(next)
  }

  return (
    <div>
      {rows.length === 0 && <div className="detail-empty">Nessuna proprietà. Aggiungine una (es. <code>repliche: 3</code>).</div>}
      {rows.map(([k, v], i) => (
        <div key={i} className="prop-row">
          <input
            value={k}
            placeholder="chiave"
            onChange={(e) => setRow(i, e.target.value, v)}
            onBlur={() => commit(rows)}
          />
          <input
            value={v}
            placeholder="valore"
            onChange={(e) => setRow(i, k, e.target.value)}
            onBlur={() => commit(rows)}
          />
          <button
            className="small ghost"
            title="Rimuovi proprietà"
            onClick={() => {
              const next = rows.filter((_, j) => j !== i)
              setRows(next)
              commit(next)
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="small"
        onClick={() => {
          const next: [string, string][] = [...rows, ['', '']]
          setRows(next)
        }}
      >
        + Proprietà
      </button>
    </div>
  )
}

export function ComponentDetailView({ id }: { id: string }) {
  const data = useStore((s) => s.data)
  const issues = useStore((s) => s.issues)
  const applyOps = useStore((s) => s.applyOps)
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)
  const showToast = useStore((s) => s.showToast)
  const generateArtifact = useStore((s) => s.generateArtifact)
  const [draft, setDraft] = useState<{ name: string; description: string; responsibilities: string; technology: string } | null>(null)

  const node = data?.model.nodes.find((n) => n.id === id)
  const model = data?.model

  useEffect(() => {
    if (node)
      setDraft({
        name: node.name,
        description: node.description,
        responsibilities: node.responsibilities.join('\n'),
        technology: node.technology
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, node?.updatedAt, node?.name])

  const dirty = useMemo(
    () =>
      node &&
      draft &&
      (draft.name !== node.name ||
        draft.description !== node.description ||
        draft.responsibilities !== node.responsibilities.join('\n') ||
        draft.technology !== node.technology),
    [node, draft]
  )

  if (!node || !model || !draft) {
    return (
      <div className="center-panel">
        <div className="empty-hint">Componente non trovato.</div>
      </div>
    )
  }

  const save = async () => {
    const ok = await applyOps([
      {
        op: 'update_node',
        id: node.id,
        patch: {
          name: draft.name,
          description: draft.description,
          technology: draft.technology,
          responsibilities: draft.responsibilities.split('\n').filter((x) => x.trim())
        }
      }
    ])
    if (ok) showToast('Componente aggiornato')
  }

  const color = techColor(node.type, node.category)
  const tech = techInfo(node.type)
  const group = model.groups.find((g) => g.id === node.groupId)
  const linkedArtifacts = model.artifacts.filter((a) => a.nodeIds.includes(node.id))
  const nodeIssues = issues.filter((i) => i.nodeIds?.includes(node.id))
  return (
    <div className="center-panel detail-view">
      <div className="detail-head">
        <div className="detail-icon" style={{ background: `${color}22`, color }}>
          {nodeIcon(node.type)}
        </div>
        <div className="detail-head-main">
          <input
            className="detail-title"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onBlur={() => draft.name !== node.name && void save()}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <div className="detail-sub">
            <span className="chip" style={{ borderColor: `${color}66`, color }}>{tech.label}</span>
            <span className="chip">{CATEGORY_LABELS[node.category]}</span>
            {group && <span className="chip" style={{ borderColor: `${group.color}66` }}>{group.name}</span>}
            {node.tags.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
        <div className="detail-actions">
          <button
            className="small primary"
            disabled={!dirty}
            title="Salva le modifiche (⌘Z per annullare)"
            onClick={() => void save()}
          >
            Salva
          </button>
          <button className="small" onClick={() => { select([node.id]); setView({ kind: 'canvas' }) }}>
            Mostra sulla canvas
          </button>
          <button className="small" onClick={() => void generateArtifact('component', node.id)}>
            Genera specifica
          </button>
          <button
            className="small danger"
            onClick={() => {
              void applyOps([{ op: 'delete_node', id: node.id }])
              setView({ kind: 'canvas' })
            }}
          >
            Elimina
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <section className="detail-card">
          <h3>Descrizione</h3>
          <textarea
            rows={4}
            value={draft.description}
            placeholder="A cosa serve questo componente…"
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            onBlur={() => draft.description !== node.description && void save()}
          />
          <h3>Tecnologia</h3>
          <input
            value={draft.technology}
            placeholder="es. Node.js 20, PostgreSQL 16…"
            onChange={(e) => setDraft({ ...draft, technology: e.target.value })}
            onBlur={() => draft.technology !== node.technology && void save()}
          />
          <h3>Responsabilità</h3>
          <textarea
            rows={5}
            value={draft.responsibilities}
            placeholder="Una responsabilità per riga"
            onChange={(e) => setDraft({ ...draft, responsibilities: e.target.value })}
            onBlur={() => draft.responsibilities !== node.responsibilities.join('\n') && void save()}
          />
        </section>

        <section className="detail-card">
          <h3>Interfacce in ingresso ({model.relations.filter((r) => r.targetId === node.id).length})</h3>
          <RelTable model={model} nodeId={node.id} dir="in" />
          <h3>Interfacce in uscita ({model.relations.filter((r) => r.sourceId === node.id).length})</h3>
          <RelTable model={model} nodeId={node.id} dir="out" />
        </section>

        <section className="detail-card">
          <h3>Proprietà</h3>
          <PropertiesEditor nodeId={node.id} properties={node.properties} />
          <h3>Metadati</h3>
          <div className="detail-meta">
            <div><span>Id</span><code>{node.id}</code></div>
            <div><span>Creato</span>{new Date(node.createdAt).toLocaleString()}</div>
            <div><span>Aggiornato</span>{new Date(node.updatedAt).toLocaleString()}</div>
            <div><span>Categoria</span>{CATEGORY_LABELS[node.category]}</div>
          </div>
        </section>

        <section className="detail-card">
          <h3>Artefatti collegati ({linkedArtifacts.length})</h3>
          {linkedArtifacts.length === 0 && <div className="detail-empty">Nessun artefatto collegato.</div>}
          <div>
            {linkedArtifacts.map((a) => (
              <div key={a.id} className="detail-artifact-row clickable" onClick={() => useStore.getState().openArtifact(a.id)}>
                <span>{a.title}</span>
                <span className="badge">{a.category}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="small" onClick={() => void generateArtifact('component', node.id)}>+ Specifica componente</button>
            <button className="small" onClick={() => void generateArtifact('api', node.id)}>+ Specifica API</button>
            <button className="small" onClick={() => void generateArtifact('dataflow', node.id)}>+ Flusso di dati</button>
          </div>

          <h3>Problemi ({nodeIssues.length})</h3>
          {nodeIssues.length === 0 && <div className="detail-empty">Nessun problema di validazione su questo componente.</div>}
          {nodeIssues.map((i) => (
            <div key={i.id} style={{ fontSize: 12, color: i.severity === 'error' ? 'var(--error)' : 'var(--warn)', marginBottom: 6 }}>
              {i.message}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

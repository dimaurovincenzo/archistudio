import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { ArchiArtifact, ArchiGroup, ArchiNode, ArtifactCategory } from '../../../shared/types'
import { nodeIcon, techColor } from '../icons'
import { api } from '../api'

const ARTIFACT_LABELS: Record<ArtifactCategory, string> = {
  requirements: 'Requisiti',
  system: 'Specifica di Sistema',
  component: 'Specifica Componente',
  api: 'Specifica API',
  database: 'Schema Database',
  dataflow: 'Flusso di Dati',
  adr: 'ADR',
  deployment: 'Deployment'
}

export function Explorer() {
  const data = useStore((s) => s.data)
  const selection = useStore((s) => s.selection)
  const focusNode = useStore((s) => s.focusNode)
  const openDetail = useStore((s) => s.openDetail)
  const openArtifact = useStore((s) => s.openArtifact)
  const applyOps = useStore((s) => s.applyOps)
  const generateArtifact = useStore((s) => s.generateArtifact)
  const pendingMcp = useStore((s) => s.pendingMcpProposals)
  const voteMcp = useStore((s) => s.voteMcpProposal)
  const activeArtifactId = useStore((s) => (s.view.kind === 'artifact' ? s.activeArtifactId : null))
  const collapsed = useStore((s) => s.collapsed)
  const searchFocusNonce = useStore((s) => s.searchFocusNonce)
  const applyOpsLocal = applyOps
  const [query, setQuery] = useState('')

  const model = data?.model

  const collapsedParents = useMemo(() => {
    const set = new Set<string>()
    for (const id of Object.keys(collapsed)) set.add(id)
    return set
  }, [collapsed])

  // conto dei sotto-nodi per padre (per il badge nell'albero quando collassato)
  const subCountByParent = useMemo(() => {
    const m = new Map<string, number>()
    if (!model) return m
    for (const r of model.relations) {
      if (r.type === 'component') m.set(r.sourceId, (m.get(r.sourceId) ?? 0) + 1)
    }
    return m
  }, [model])
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchFocusNonce > 0) {
      searchRef.current?.focus()
      searchRef.current?.select()
    }
  }, [searchFocusNonce])

  // un solo risultato? porta l'utente lì (canvas centrata sul nodo, selezionato)
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || !data) return
    const t = setTimeout(() => {
      const matches = data.model.nodes.filter((n) =>
        `${n.name} ${n.type} ${n.technology} ${n.tags.join(' ')}`.toLowerCase().includes(q)
      )
      if (matches.length === 1) useStore.getState().focusNode(matches[0].id)
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const nodeMenu = (n: ArchiNode) => {
    const groups: ArchiGroup[] = data?.model.groups ?? []
    void api.ctx
      .show([
        { id: 'focus', label: 'Apri nell\'Inspector' },
        { id: 'duplicate', label: 'Duplica' },
        { type: 'separator' },
        { id: 'spec', label: 'Genera specifica componente' },
        { id: 'api', label: 'Genera specifica API' },
        ...(groups.length > 0 ? [{ type: 'separator' as const }, ...groups.map((g) => ({ id: `group:${g.id}`, label: `Sposta in «${g.name}»` }))] : []),
        { type: 'separator' },
        { id: 'delete', label: 'Elimina' }
      ])
      .then((id) => {
        if (!id) return
        if (id === 'focus') focusNode(n.id)
        else if (id === 'duplicate')
          void applyOpsLocal([
            {
              op: 'create_node',
              node: { ...n, name: `${n.name} copy`, id: undefined, position: { x: n.position.x + 42, y: n.position.y + 42 } }
            } as never
          ])
        else if (id === 'spec') void generateArtifact('component', n.id)
        else if (id === 'api') void generateArtifact('api', n.id)
        else if (id.startsWith('group:')) {
          const gid = id.slice(6)
          void applyOpsLocal([{ op: 'update_node', id: n.id, patch: { groupId: gid } }])
        } else if (id === 'delete') void applyOpsLocal([{ op: 'delete_node', id: n.id }])
      })
  }

  const artifactMenu = (a: ArchiArtifact) => {
    void api.ctx
      .show([
        { id: 'open', label: 'Apri' },
        { id: 'regen', label: 'Rigenera dal modello' },
        { type: 'separator' },
        { id: 'delete', label: 'Elimina' }
      ])
      .then((id) => {
        if (id === 'open') openArtifact(a.id)
        else if (id === 'regen') void generateArtifact(a.category, a.nodeIds[0], a.title)
        else if (id === 'delete') void applyOpsLocal([{ op: 'delete_artifact', id: a.id }])
      })
  }

  const groupMenu = (g: ArchiGroup) => {
    void api.ctx
      .show([
        { id: 'add', label: 'Aggiungi nodo al gruppo' },
        { type: 'separator' },
        { id: 'delete', label: 'Elimina gruppo (mantieni i nodi)' }
      ])
      .then((id) => {
        if (id === 'add') void applyOpsLocal([{ op: 'create_node', node: { name: 'Nuovo componente', type: 'generic', groupId: g.id } }])
        else if (id === 'delete') void applyOpsLocal([{ op: 'delete_group', id: g.id }])
      })
  }

  const q = query.trim().toLowerCase()

  const groups = useMemo(
    () => (model ? model.groups.filter((g) => !q || g.name.toLowerCase().includes(q)) : []),
    [model, q]
  )
  // coerenza con la canvas: i sotto-nodi dei padri collassati non si mostrano nell'albero
  const collapsedSubIds = useMemo(() => {
    const set = new Set<string>()
    if (!model) return set
    for (const r of model.relations) {
      if (r.type === 'component' && collapsedParents.has(r.sourceId)) set.add(r.targetId)
    }
    return set
  }, [model, collapsedParents])

  const nodesByGroup = useMemo(() => {
    const map = new Map<string | null, ArchiNode[]>()
    if (!model) return map
    for (const n of model.nodes) {
      if (collapsedSubIds.has(n.id) && !q) continue
      if (q && !`${n.name} ${n.type} ${n.technology}`.toLowerCase().includes(q)) continue
      const list = map.get(n.groupId) ?? []
      list.push(n)
      map.set(n.groupId, list)
    }
    return map
  }, [model, q, collapsedSubIds])

  const artifactsByCat = useMemo(() => {
    const map = new Map<ArtifactCategory, ArchiArtifact[]>()
    if (!model) return map
    for (const a of model.artifacts) {
      if (q && !`${a.title} ${a.category}`.toLowerCase().includes(q)) continue
      const list = map.get(a.category) ?? []
      list.push(a)
      map.set(a.category, list)
    }
    return map
  }, [model, q])

  if (!data) return <div className="explorer" />

  return (
    <div className="explorer">
      <div className="explorer-head">
        <span className="explorer-drag" />
      </div>
      <div className="explorer-search">
        <input ref={searchRef} placeholder="Cerca componenti, artefatti… (⌘F)" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="explorer-section">
        <div className="explorer-title">
          <span>Architettura</span>
        </div>

        {groups.map((g) => (
          <div key={g.id}>
            <div className="tree-group" onContextMenu={(e) => { e.preventDefault(); groupMenu(g) }}>
              <span className="cat-dot" style={{ background: g.color }} />
              {g.name}
              <span style={{ flex: 1 }} />
              <span className="t-icon" title="Tasto destro: aggiungi nodo · elimina gruppo" />
            </div>
            <div className="tree-indent">
              {(nodesByGroup.get(g.id) ?? []).map((n) => <NodeRow key={n.id} node={n} />)}
            </div>
          </div>
        ))}
        {(nodesByGroup.get(null) ?? []).map((n) => <NodeRow key={n.id} node={n} />)}

        <div className="explorer-title">
          <span>Artefatti</span>
        </div>
        {[...artifactsByCat.keys()].map((cat) => (
          <div key={cat}>
            <div className="tree-group">{ARTIFACT_LABELS[cat]}</div>
            <div className="tree-indent">
              {(artifactsByCat.get(cat) ?? []).map((a) => (
                <div
                  key={a.id}
                  className={`tree-item${activeArtifactId === a.id ? ' active' : ''}`}
                  onClick={() => openArtifact(a.id)}
                  onContextMenu={(e) => { e.preventDefault(); artifactMenu(a) }}
                  title={a.title}
                >
                  <span className="cat-dot" style={{ background: '#64748b' }} />
                  <span className="t-name">{a.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}


        {pendingMcp.length > 0 && (
          <>
            <div className="explorer-title">
              <span>Proposte MCP ({pendingMcp.length})</span>
            </div>
            {pendingMcp.map((p) => (
              <div key={p.id} style={{ background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 9, padding: 9, margin: '4px 2px' }}>
                <div style={{ fontWeight: 600, fontSize: 11.5, marginBottom: 2 }}>{p.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: 10.5, marginBottom: 7 }}>
                  da {p.clientInfo ?? 'client esterno'} — {p.ops.length} operazioni
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="small primary" onClick={() => voteMcp(p.id, 'approved')}>Approva</button>
                  <button className="small danger" onClick={() => voteMcp(p.id, 'rejected')}>Rifiuta</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )

  function NodeRow({ node: n }: { node: ArchiNode }) {
    const color = techColor(n.type, n.category)
    const subCount = subCountByParent.get(n.id) ?? 0
    const isCollapsed = Boolean(collapsed[n.id]) && subCount > 0
    return (
      <div
        className={`tree-item${selection.nodeIds.includes(n.id) ? ' active' : ''}`}
        onClick={() => focusNode(n.id)}
        onDoubleClick={(e) => { e.stopPropagation(); openDetail(n.id) }}
        onContextMenu={(e) => { e.preventDefault(); nodeMenu(n) }}
        title={`${n.description || n.name} — doppio click per il dettaglio`}
      >
        <span className="cat-dot" style={{ background: color }} />
        <span className="t-name">{n.name}</span>
        {isCollapsed && <span className="mods-badge" style={{ background: `${color}33`, color }}>{subCount} moduli</span>}
        <span className="t-icon">{nodeIcon(n.type)}</span>
      </div>
    )
  }
}

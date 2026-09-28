import { memo, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeChange,
  NodeTypes,
  OnSelectionChangeParams,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'
import { useStore, getLastSelectTs } from '../store'
import { ArchiGroup, ArchiModel, ArchiNode, CtxItem } from '../../../shared/types'
import { nodeIcon, techColor, techLabel, relationColor } from '../icons'
import { techInfo } from '../../../shared/tech'
import { api } from '../api'
import { buildAlignOps, buildGroupOps, extractClipboard, buildPasteOps } from '../utils/align'
import { PlussIcon, LayoutIcon, FitIcon, SnapIcon, MapIcon, LayersIcon, AlignLeftIcon, AlignTopIcon, DistHIcon, DistVIcon, GroupIcon, DuplicateIcon, TrashIcon } from './toolbarIcons'

interface ArchiNodeData extends Record<string, unknown> {
  node: ArchiNode
  /** input di rinomina inline attivo su questo nodo (tasto Invio) */
  editing?: boolean
  /** numero di sotto-componenti (padre decomposto) */
  subCount?: number
  /** true se i sotto-componenti sono collassati dentro questo nodo */
  collapsedNode?: boolean
  dimmed: boolean
  /** selezione visiva gestita da noi: NON usare il flag `selected` di RF (loop #185) */
  sel: boolean
  /** true per i vicini diretti della selezione: attiva il glow di illuminazione */
  near: boolean
  /** true per la radice di un sotto-grafo espanso */
  root: boolean
  /** nonce della selezione: ri-triggera l'animazione di glow sui vicini */
  nonce: number
}

interface GroupBoxData extends Record<string, unknown> {
  group: ArchiGroup
}

const GROUP_PREFIX = '__grp_'
const ASYNC_REL = new Set(['queue', 'event', 'websocket'])
const STRUCT_REL = new Set(['component'])
const NODE_W = 190
const NODE_H = 84
const GROUP_PAD = 26

async function applyOpsRename(id: string, name: string): Promise<void> {
  await useStore.getState().applyOps([{ op: 'update_node', id, patch: { name } }])
}

const ArchiNodeView = memo(function ArchiNodeView({ data }: { data: ArchiNodeData }) {
  const n = data.node
  const color = techColor(n.type, n.category)
  const tech = techInfo(n.type)
  const host = n.properties?.host
  const port = n.properties?.port
  const instances = n.properties?.instances
  const domain = n.properties?.domain
  const endpoint = [host, port].filter(Boolean).join(':')
  const meta = [endpoint, instances ? `${instances}×` : '', domain].filter(Boolean).join(' · ')
  return (
    <div
      key={data.near ? `glow-${data.nonce}` : 'static'}
      className={`arch-node${data.sel ? ' selected' : ''}${data.dimmed ? ' dimmed' : ''}${data.near ? ' neighbor' : ''}${data.root ? ' root-node' : ''}`}
      style={{ '--glow': `${color}55` } as CSSProperties}
    >
      <Handle type="target" position={Position.Left} className="arch-handle" isConnectable />
      <div className="row">
        <div className="icon-tile" style={{ background: `${color}22`, color }}>
          {nodeIcon(n.type)}
        </div>
        <div>
          <div className="n-name">
            {data.editing ? (
              <input
                className="n-rename"
                autoFocus
                defaultValue={n.name}
                title="Invio per confermare · Esc per annullare"
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (v && v !== n.name) void applyOpsRename(n.id, v)
                    useStore.getState().setEditingNodeId(null)
                  } else if (e.key === 'Escape') {
                    useStore.getState().setEditingNodeId(null)
                  }
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== n.name) void applyOpsRename(n.id, v)
                  useStore.getState().setEditingNodeId(null)
                }}
              />
            ) : (
              <>
                {n.name}
                {data.collapsedNode && data.subCount ? (
                  <span className="mods-badge" style={{ background: `${color}33`, color }}>{data.subCount} moduli</span>
                ) : null}
              </>
            )}
          </div>
          <div className="n-type">{tech.label}</div>
        </div>
      </div>
      {n.technology && <div className="n-tech">{n.technology}</div>}
      {meta && <div className="n-meta">{meta}</div>}
      <Handle type="source" position={Position.Right} className="arch-handle" isConnectable />
    </div>
  )
})

const GroupBoxView = memo(function GroupBoxView({ data }: { data: GroupBoxData }) {
  const g = data.group
  return (
    <div className="group-box" style={{ borderColor: `${g.color}55`, background: `${g.color}0d` }}>
      <span className="group-box-label" style={{ color: g.color }}>{g.name}</span>
    </div>
  )
})

const nodeTypes: NodeTypes = { archi: ArchiNodeView, groupBox: GroupBoxView }

/** Controlli zoom nella toolbar: il livello si aggiorna via useViewport senza ridisegnare la canvas. */
/** Barra azioni multi-selezione: allinea, distribuisci, raggruppa, duplica, elimina. */
function MultiSelectBar({ nodeIds }: { nodeIds: string[] }) {
  const applyOps = useStore((s) => s.applyOps)
  const select = useStore((s) => s.select)
  const data = useStore((s) => s.data)

  const alignables = useMemo(
    () => (data?.model.nodes ?? []).filter((n) => nodeIds.includes(n.id)).map((n) => ({ id: n.id, position: { ...n.position } })),
    [data, nodeIds]
  )

  const runAlign = (mode: 'left' | 'top' | 'dist-h' | 'dist-v') => {
    const { ops } = buildAlignOps(alignables, mode)
    if (ops.length > 0) void applyOps(ops)
  }

  const groupSelected = async () => {
    const name = await useStore.getState().requestInput('Nome del gruppo:', 'Nuovo gruppo')
    if (!name?.trim()) return
    const nodes = (data?.model.nodes ?? []).filter((n) => nodeIds.includes(n.id))
    const ops = buildGroupOps(nodes, name.trim())
    await applyOps(ops)
    useStore.getState().showToast(`Gruppo «${name.trim()}» creato con ${nodes.length} componenti`)
  }

  const duplicateSelected = async () => {
    if (!data) return
    const clip = extractClipboard(data.model, nodeIds)
    if (!clip) return
    const { ops, pastedIds } = buildPasteOps(clip, { x: 44, y: 44 })
    if (await applyOps(ops)) select(pastedIds)
  }

  const deleteSelected = () => {
    void applyOps(nodeIds.map((id) => ({ op: 'delete_node', id })))
    select([])
  }

  const btn = (title: string, icon: React.ReactNode, run: () => void) => (
    <button className="small ghost" title={title} onClick={run}>{icon}</button>
  )

  return (
    <div className="multisel-bar">
      <span className="ms-count">{nodeIds.length} selezionati</span>
      <span className="eb-sep" />
      {btn('Allinea a sinistra', <AlignLeftIcon />, () => runAlign('left'))}
      {btn('Allinea in alto', <AlignTopIcon />, () => runAlign('top'))}
      {btn('Distribuisci orizzontale', <DistHIcon />, () => runAlign('dist-h'))}
      {btn('Distribuisci verticale', <DistVIcon />, () => runAlign('dist-v'))}
      <span className="eb-sep" />
      {btn('Raggruppa', <GroupIcon />, () => void groupSelected())}
      {btn('Duplica selezione', <DuplicateIcon />, () => void duplicateSelected())}
      {btn('Elimina selezione (Backspace)', <TrashIcon />, deleteSelected)}
    </div>
  )
}

/** Level of Detail: sotto zoom 0.45 nasconde meta/tech/etichette edge (classe CSS, zero re-render). */
function LodController({ wrapRef }: { wrapRef: React.RefObject<HTMLDivElement | null> }) {
  const { zoom } = useViewport()
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    el.classList.remove('lod-low', 'lod-mid', 'lod-high')
    el.classList.add(zoom < 0.45 ? 'lod-low' : zoom < 0.85 ? 'lod-mid' : 'lod-high')
  }, [zoom, wrapRef])
  return null
}

function ZoomControls() {
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const { zoom } = useViewport()
  return (
    <>
      <span className="tb-sep" />
      <button className="small" title="Riduci zoom (⌘-)" onClick={() => zoomOut({ duration: 120 })}>−</button>
      <button className="small tb-zoom" title="Ripristina zoom 100% (⌘0)" onClick={() => zoomTo(1, { duration: 200 })}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="small" title="Aumenta zoom (⌘+)" onClick={() => zoomIn({ duration: 120 })}>+</button>
    </>
  )
}

/** Box rettangolari dei gruppi, calcolati dal bounding box dei membri. */
function groupBoxNodes(model: ArchiModel, positions?: Map<string, { x: number; y: number }>): Node[] {
  const out: Node[] = []
  for (const g of model.groups) {
    const members = model.nodes.filter((n) => n.groupId === g.id)
    if (members.length === 0) continue
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const m of members) {
      const p = positions?.get(m.id) ?? m.position
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + NODE_W)
      maxY = Math.max(maxY, p.y + NODE_H)
    }
    out.push({
      id: `${GROUP_PREFIX}${g.id}`,
      type: 'groupBox',
      position: { x: minX - GROUP_PAD, y: minY - GROUP_PAD },
      data: { group: g },
      style: { width: maxX - minX + GROUP_PAD * 2, height: maxY - minY + GROUP_PAD * 2 },
      draggable: false,
      selectable: false,
      deletable: false,
      connectable: false,
      zIndex: -1
    })
  }
  return out
}

/** Aggiorna i box dei gruppi alle posizioni correnti dei membri (durante il drag). */
function refreshGroupBoxes(nds: Node[], model: ArchiModel): Node[] {
  const positions = new Map<string, { x: number; y: number }>()
  for (const n of nds) {
    if (!n.id.startsWith(GROUP_PREFIX)) positions.set(n.id, n.position)
  }
  const wanted = groupBoxNodes(model, positions)
  const byId = new Map(wanted.map((b) => [b.id, b]))
  let changed = false
  const kept = nds.map((n) => {
    if (!n.id.startsWith(GROUP_PREFIX)) return n
    const nb = byId.get(n.id)
    if (!nb) {
      changed = true
      return n
    }
    const st = n.style as { width?: number; height?: number } | undefined
    const same =
      n.position.x === nb.position.x &&
      n.position.y === nb.position.y &&
      st?.width === (nb.style as { width: number }).width &&
      st?.height === (nb.style as { height: number }).height
    if (same) return n
    changed = true
    return { ...n, position: nb.position, style: nb.style }
  })
  const missing = wanted.filter((b) => !nds.some((n) => n.id === b.id))
  if (missing.length > 0) changed = true
  return changed ? [...kept, ...missing] : nds
}

/** BFS di espansione: nodi entro `depth` hop dal root (grafo non orientato) + relazioni interne. */
function subgraph(model: ArchiModel, rootId: string, depth: number): { nodeIds: Set<string>; relIds: Set<string> } {
  const nodeIds = new Set<string>([rootId])
  let frontier = new Set<string>([rootId])
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>()
    for (const r of model.relations) {
      if (frontier.has(r.sourceId) && !nodeIds.has(r.targetId)) next.add(r.targetId)
      if (frontier.has(r.targetId) && !nodeIds.has(r.sourceId)) next.add(r.sourceId)
    }
    for (const id of next) nodeIds.add(id)
    frontier = next
    if (frontier.size === 0) break
  }
  const relIds = new Set<string>()
  for (const r of model.relations) {
    if (nodeIds.has(r.sourceId) && nodeIds.has(r.targetId)) relIds.add(r.id)
  }
  return { nodeIds, relIds }
}

function CanvasInner() {
  const data = useStore((s) => s.data)
  const modelVersion = useStore((s) => s.modelVersion)
  const selection = useStore((s) => s.selection)
  const selectionNonce = useStore((s) => s.selectionNonce)
  const expansion = useStore((s) => s.expansion)
  const setExpansionDepth = useStore((s) => s.setExpansionDepth)
  const closeExpansion = useStore((s) => s.closeExpansion)
  const collapsed = useStore((s) => s.collapsed)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const showMinimap = useStore((s) => s.showMinimap)
  const focusRequest = useStore((s) => s.focusRequest)
  const select = useStore((s) => s.select)
  const applyOps = useStore((s) => s.applyOps)
  const generateArtifact = useStore((s) => s.generateArtifact)
  const exportFile = useStore((s) => s.exportFile)
  const focusNodeById = useStore((s) => s.focusNode)
  const openDetail = useStore((s) => s.openDetail)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges] = useEdgesState<Edge>([])
  const { fitView, screenToFlowPosition, zoomIn, zoomOut, zoomTo } = useReactFlow()
  const wrapRef = useRef<HTMLDivElement>(null)
  const didFitRef = useRef('')
  const lastBoxRefresh = useRef(0)

  const selKey = `${selection.nodeIds.slice().sort().join(',')}|${selection.relationIds.slice().sort().join(',')}`

  // base nodes/edges: ricostruiti SOLO quando cambia il modello (non a ogni selezione)
  // sotto-grafo attivo: nodoIds/relIds del BFS
  const expansionIds = useMemo(() => {
    if (!data || !expansion) return null
    return subgraph(data.model, expansion.rootId, expansion.depth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, expansion?.rootId, expansion?.depth])

  // padri collassati: id dei loro sotto-nodi (relazioni component)
  const subIdsByParent = useMemo(() => {
    if (!data) return new Map<string, string[]>()
    const m = new Map<string, string[]>()
    for (const r of data.model.relations) {
      if (r.type !== 'component') continue
      m.set(r.sourceId, [...(m.get(r.sourceId) ?? []), r.targetId])
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, modelVersion])

  const base = useMemo(() => {
    if (!data) return { ns: [] as Node[], es: [] as Edge[] }
    const model = data.model
    const keep = expansionIds
    // collasso: nasconde i sotto-nodi dei padri collassati
    const hidden = new Set<string>()
    for (const [pid, subs] of subIdsByParent) {
      if (collapsed[pid]) for (const sid of subs) hidden.add(sid)
    }
    const visibleNodes = model.nodes.filter((n) => !hidden.has(n.id) && (!keep || keep.nodeIds.has(n.id)))
    const visibleGroups = (keep ? model.groups.filter((g) => model.nodes.some((n) => n.groupId === g.id && keep.nodeIds.has(n.id))) : model.groups)
      .filter((g) => visibleNodes.some((n) => n.groupId === g.id))
    const visibleRelsRaw = keep ? model.relations.filter((r) => keep.relIds.has(r.id)) : model.relations
    // reroute: le edge dei sotto-nodi nascosti vengono ricondotte al padre (il servizio resta collegato)
    const visibleRels: typeof visibleRelsRaw = []
    for (const r of visibleRelsRaw) {
      const srcH = hidden.has(r.sourceId)
      const tgtH = hidden.has(r.targetId)
      if (r.type === 'component') {
        if (srcH || tgtH) continue // edge strutturale interno: nascosta con il collasso
        visibleRels.push(r)
        continue
      }
      if (!srcH && !tgtH) {
        visibleRels.push(r)
      } else if (srcH) {
        const parent = Object.keys(collapsed).find((pid) => hidden.has(r.sourceId) && (subIdsByParent.get(pid) ?? []).includes(r.sourceId))
        if (parent) visibleRels.push({ ...r, sourceId: parent })
      } else if (tgtH) {
        const parent = Object.keys(collapsed).find((pid) => hidden.has(r.targetId) && (subIdsByParent.get(pid) ?? []).includes(r.targetId))
        if (parent) visibleRels.push({ ...r, targetId: parent })
      }
    }
    const subCountFor = (id: string) => (subIdsByParent.get(id) ?? []).length
    const ns: Node[] = [
      ...groupBoxNodes({ ...model, groups: visibleGroups }),
      ...visibleNodes.map(
        (n): Node => ({
          id: n.id,
          type: 'archi',
          position: n.position,
          data: {
            node: n,
            dimmed: false,
            sel: false,
            near: false,
            root: expansion?.rootId === n.id,
            nonce: 0,
            subCount: (subIdsByParent.get(n.id) ?? []).length,
            collapsedNode: Boolean(collapsed[n.id])
          } as ArchiNodeData
        })
      )
    ]
    const es: Edge[] = visibleRels.map((r) => ({
      id: r.id,
      source: r.sourceId,
      target: r.targetId,
      type: 'smoothstep',
      label: `${r.type.toUpperCase()}${r.protocol ? ' · ' + r.protocol : ''}`,
      className: '',
      style: {
        stroke: relationColor(r.type),
        strokeWidth: 1.7,
        ...(ASYNC_REL.has(r.type) ? { strokeDasharray: '5 3' } : STRUCT_REL.has(r.type) ? { strokeDasharray: '2 3' } : {})
      },
      labelStyle: { fill: '#aab2c5', fontSize: 9.5 },
      labelBgStyle: { fill: '#141926' }
    }))
    return { ns, es }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, modelVersion, expansionIds, subIdsByParent, collapsed])

  useEffect(() => {
    // merge che preserva l'identità: i nodi/edge invariati mantengono lo stesso oggetto
    setNodes((nds) => {
      const old = new Map(nds.map((n) => [n.id, n]))
      return base.ns.map((n) => {
        const prev = old.get(n.id)
        if (prev && prev.type === n.type && JSON.stringify(prev.data) === JSON.stringify(n.data) && prev.position.x === n.position.x && prev.position.y === n.position.y) {
          return prev
        }
        return n
      })
    })
    setEdges((eds) => {
      const old = new Map(eds.map((e) => [e.id, e]))
      return base.es.map((e) => {
        const prev = old.get(e.id)
        if (prev && JSON.stringify({ ...prev, selected: undefined }) === JSON.stringify({ ...e, selected: undefined })) {
          return prev
        }
        return e
      })
    })
  }, [base, setNodes, setEdges])

  // dimming/selection: patch leggera via data — MAI il flag `selected` di RF (loop #185)
  useEffect(() => {
    if (!data) return
    const model = data.model
    const selIds = new Set(selection.nodeIds)
    const relSel = new Set(selection.relationIds)
    const neighbors = new Set<string>()
    if (selIds.size > 0) {
      for (const r of model.relations) {
        if (selIds.has(r.sourceId)) neighbors.add(r.targetId)
        if (selIds.has(r.targetId)) neighbors.add(r.sourceId)
      }
    }
    const hasSel = selIds.size > 0 || relSel.size > 0
    const nonce = selectionNonce
    const q = useStore.getState().searchQuery.trim().toLowerCase()
    const matches = (n: ArchiNode) =>
      !q || `${n.name} ${n.type} ${techLabel(n.type)} ${n.technology} ${n.tags.join(' ')}`.toLowerCase().includes(q)
    const matchedIds = q ? new Set(model.nodes.filter(matches).map((n) => n.id)) : null
    setNodes((nds) => {
      let changed = false
      const next = nds.map((n) => {
        if (n.type === 'groupBox') return n
        const d = n.data as ArchiNodeData
        let dimmed = hasSel && selIds.size > 0 && !selIds.has(n.id) && !neighbors.has(n.id)
        if (matchedIds && n.type === 'archi') {
          const d = n.data as ArchiNodeData
          if (d?.node && !matchedIds.has(d.node.id)) dimmed = true
        }
        const sel = selIds.has(n.id)
        const near = selIds.size > 0 && neighbors.has(n.id)
        const editing = useStore.getState().editingNodeId === n.id
        if (d.dimmed === dimmed && d.sel === sel && d.near === near && d.nonce === nonce && d.editing === editing) return n
        changed = true
        return { ...n, data: { ...d, dimmed, sel, near, nonce, editing } }
      })
      return changed ? next : nds
    })
    setEdges((eds) => {
      let changed = false
      const next = eds.map((e) => {
        const touches = selIds.has(e.source) || selIds.has(e.target)
        let dim = hasSel && !relSel.has(e.id) && !selIds.has(e.source) && !selIds.has(e.target)
        if (matchedIds) dim = !matchedIds.has(e.source) && !matchedIds.has(e.target)
        const cls = `${dim ? 'dimmed' : ''}${relSel.has(e.id) ? ' edge-selected' : ''}${touches && selIds.size > 0 && !matchedIds ? ' edge-live' : ''}`
        if ((e.className ?? '') === cls) return e
        changed = true
        return { ...e, className: cls }
      })
      return changed ? next : eds
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, base])

  useEffect(() => {
    if (nodes.length === 0) return
    if (didFitRef.current === data?.meta.id) return
    didFitRef.current = data?.meta.id ?? ''
    const t = setTimeout(() => fitView({ padding: 0.18, duration: 350 }), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length])

  useEffect(() => {
    if (!focusRequest) return
    const n = nodes.find((x) => x.id === focusRequest.nodeId)
    if (n) fitView({ nodes: [n], padding: 2.4, duration: 380 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce])

  // sotto-grafo: adatta la vista ai soli nodi espansi
  useEffect(() => {
    if (!expansion) return
    const t = setTimeout(() => fitView({ padding: 0.22, duration: 420 }), 220)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expansion?.rootId, expansion?.depth])

  // E = espandi/ri-espandi dal nodo selezionato · Esc = esci dal sotto-grafo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Escape' && expansion) closeExpansion()
      else if (e.key === 'Enter') {
        const st = useStore.getState()
        if (st.selection.nodeIds.length === 1 && !st.editingNodeId) {
          e.preventDefault()
          st.setEditingNodeId(st.selection.nodeIds[0])
        }
      } else if (e.shiftKey && (e.key === '1' || e.key === '2')) {
        const st = useStore.getState()
        if (e.key === '1') fitView({ padding: 0.18, duration: 350 })
        else if (st.selection.nodeIds.length > 0) {
          const sel = nodes.filter((n) => st.selection.nodeIds.includes(n.id))
          if (sel.length > 0) fitView({ nodes: sel, padding: 1.6, duration: 350 })
        }
        e.preventDefault()
      } else if ((e.key === 'e' || e.key === 'E') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const st = useStore.getState()
        if (st.selection.nodeIds.length === 1 && st.data) {
          st.expandNode(st.selection.nodeIds[0], st.expansion?.depth ?? 2)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expansion, closeExpansion])

  const commitPositions = (dragged: Node[]) => {
    const real = dragged.filter((n) => !n.id.startsWith(GROUP_PREFIX))
    if (real.length === 0) return
    void applyOps(
      real.map((n) => ({ op: 'set_position', id: n.id, position: n.position })),
      'ui'
    )
  }

  const onSelectionChange = ({ nodes: sn, edges: se }: OnSelectionChangeParams) => {
    const nodeIds = sn.filter((n) => !n.id.startsWith(GROUP_PREFIX)).map((n) => n.id)
    const relationIds = se.map((e) => e.id)
    // eco di RF: quando sostituiamo i nodi (glow/dimming) RF resetta la selezione interna
    // e risponde con un evento vuoto — va ignorato se segue a stretto giro una nostra select
    if (nodeIds.length === 0 && relationIds.length === 0 && Date.now() - getLastSelectTs() < 150) {
      return
    }
    const prev = useStore.getState().selection
    if (
      prev.nodeIds.slice().sort().join(',') === nodeIds.slice().sort().join(',') &&
      prev.relationIds.slice().sort().join(',') === relationIds.slice().sort().join(',')
    ) {
      return
    }
    select(nodeIds, relationIds)
  }

  const onConnect = async (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    const ok = await applyOps([
      { op: 'create_relation', relation: { sourceId: c.source, targetId: c.target, type: 'dependency' } }
    ])
    if (!ok) return
    // la relazione nuova viene selezionata: l'Inspector mostra subito l'editor col tipo
    const st = useStore.getState()
    const rel = [...st.data?.model.relations ?? []]
      .filter((r) => r.sourceId === c.source && r.targetId === c.target)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (rel) st.select([], [rel.id])
  }

  const addComponentAt = async (pos: { x: number; y: number }) => {
    const st0 = useStore.getState()
    // nome progressivo: mai due "Nuovo componente" nello stesso progetto
    const used = new Set((st0.data?.model.nodes ?? []).map((n) => n.name))
    let name = 'Componente 1'
    for (let i = 2; used.has(name); i++) name = `Componente ${i}`
    const ok = await applyOps([{ op: 'create_node', node: { name, type: 'generic', position: pos } }])
    if (!ok) return
    // entra subito in rinomina: il nome si scrive sul nodo, poi il campo Tipo nell'Inspector
    const st = useStore.getState()
    const created = [...(st.data?.model.nodes ?? [])]
      .filter((n) => n.name === name)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (created) {
      st.select([created.id])
      st.setEditingNodeId(created.id)
    }
  }

  const addComponent = () => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const pos = rect
      ? screenToFlowPosition({ x: rect.width / 2, y: rect.height / 2 })
      : { x: 200, y: 200 }
    addComponentAt(pos)
  }

  const addGroup = () => {
    void applyOps([{ op: 'create_group', group: { name: 'Nuovo gruppo' } }])
  }

  const autoLayout = () => {
    if (!data) return
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 150 })
    for (const n of data.model.nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H })
    for (const r of data.model.relations) g.setEdge(r.sourceId, r.targetId)
    dagre.layout(g)
    const ops = data.model.nodes.map((n) => {
      const pos = g.node(n.id)
      return { op: 'set_position' as const, id: n.id, position: { x: pos.x - 95, y: pos.y - 40 } }
    })
    void applyOps(ops).then(() => setTimeout(() => fitView({ padding: 0.18, duration: 350 }), 250))
  }

  // canvas commands arriving from the app menu / palette
  const canvasCmd = useStore((s) => s.canvasCmd)
  useEffect(() => {
    if (!canvasCmd) return
    if (canvasCmd.cmd === 'zoom-in') zoomIn({ duration: 200 })
    else if (canvasCmd.cmd === 'zoom-out') zoomOut({ duration: 200 })
    else if (canvasCmd.cmd === 'zoom-reset') zoomTo(1, { duration: 220 })
    else if (canvasCmd.cmd === 'fit') fitView({ padding: 0.18, duration: 350 })
    else if (canvasCmd.cmd === 'auto-layout') autoLayout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasCmd?.nonce])

  const showCtx = async (items: CtxItem[], handler: (id: string) => void) => {
    const picked = await api.ctx.show(items)
    if (picked) handler(picked)
  }

  const duplicateNode = (nodeId: string) => {
    if (!data) return
    const n = data.model.nodes.find((x) => x.id === nodeId)
    if (!n) return
    void applyOps([
      {
        op: 'create_node',
        node: {
          name: `${n.name} copy`,
          type: n.type,
          category: n.category,
          description: n.description,
          responsibilities: [...n.responsibilities],
          technology: n.technology,
          tags: [...n.tags],
          groupId: n.groupId,
          position: { x: n.position.x + 42, y: n.position.y + 42 }
        }
      }
    ])
  }

  const nodeCtxActions = (nodeId: string, id: string) => {
    if (id === 'focus') focusNodeById(nodeId)
    else if (id === 'detail') openDetail(nodeId)
    else if (id === 'expand') useStore.getState().expandNode(nodeId)
    else if (id === 'duplicate') duplicateNode(nodeId)
    else if (id === 'spec-component') void generateArtifact('component', nodeId)
    else if (id === 'spec-api') void generateArtifact('api', nodeId)
    else if (id === 'dataflow') void generateArtifact('dataflow', nodeId)
    else if (id === 'delete') {
      void applyOps([{ op: 'delete_node', id: nodeId }])
      select([])
    } else if (id.startsWith('group:')) {
      const gid = id.slice(6)
      void applyOps([{ op: 'update_node', id: nodeId, patch: { groupId: gid === 'none' ? null : gid } }])
    }
  }

  const onNodeCtx = (event: ReactMouseEvent, node: Node) => {
    if (node.id.startsWith(GROUP_PREFIX)) return
    event.preventDefault()
    const groups = data?.model.groups ?? []
    void showCtx(
      [
        { id: 'focus', label: 'Apri nell\'Inspector' },
        { id: 'detail', label: 'Apri vista dettaglio' },
        { id: 'expand', label: 'Espandi sotto-grafo…' },
        { id: 'duplicate', label: 'Duplica', accelerator: 'Cmd+D' },
        { type: 'separator' },
        { id: 'spec-component', label: 'Genera specifica componente' },
        { id: 'spec-api', label: 'Genera specifica API' },
        { id: 'dataflow', label: 'Traccia flusso di dati da qui' },
        { type: 'separator' },
        ...(groups.length > 0
          ? [
              { id: 'group:none', label: 'Rimuovi dal gruppo' },
              ...groups.map((g) => ({ id: `group:${g.id}`, label: `Sposta in «${g.name}»` })),
              { type: 'separator' as const }
            ]
          : []),
        { id: 'delete', label: 'Elimina', enabled: true }
      ],
      (id) => nodeCtxActions(node.id, id)
    )
  }

  const onEdgeCtx = (event: ReactMouseEvent, edge: Edge) => {
    event.preventDefault()
    void showCtx(
      [
        ...['rest', 'http', 'graphql', 'websocket', 'event', 'queue', 'db', 'auth', 'dependency', 'dataflow'].map((t) => ({
          id: `type:${t}`,
          label: `Tipo: ${t.toUpperCase()}`
        })),
        { type: 'separator' },
        { id: 'swap', label: 'Inverti direzione' },
        { id: 'delete', label: 'Elimina', accelerator: 'Backspace' }
      ],
      (id) => {
        if (id.startsWith('type:')) {
          void applyOps([{ op: 'update_relation', id: edge.id, patch: { type: id.slice(5) } }])
        } else if (id === 'swap') {
          if (!data) return
          const r = data.model.relations.find((x) => x.id === edge.id)
          if (r) void applyOps([{ op: 'update_relation', id: r.id, patch: { sourceId: r.targetId, targetId: r.sourceId } }])
        } else if (id === 'delete') {
          void applyOps([{ op: 'delete_relation', id: edge.id }])
          select([])
        }
      }
    )
  }

  const onPaneCtx = (event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault()
    const cursorPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    void showCtx(
      [
        { id: 'add-component', label: 'Aggiungi componente qui' },
        { id: 'add-group', label: 'Aggiungi gruppo…', accelerator: 'Cmd+G' },
        { type: 'separator' },
        { id: 'layout', label: 'Layout automatico', accelerator: 'Cmd+L' },
        { id: 'fit', label: 'Adatta vista', accelerator: 'Cmd+8' },
        { type: 'separator' },
        { id: 'export-json', label: 'Esporta JSON…' },
        { id: 'export-mermaid', label: 'Esporta Mermaid…' },
        { id: 'export-svg', label: 'Esporta SVG…' }
      ],
      (id) => {
        if (id === 'add-component') addComponentAt(cursorPos)
        else if (id === 'add-group') addGroup()
        else if (id === 'layout') autoLayout()
        else if (id === 'fit') fitView({ padding: 0.18, duration: 350 })
        else if (id === 'export-json') void exportFile('json')
        else if (id === 'export-mermaid') void exportFile('mermaid')
        else if (id === 'export-svg') void exportFile('svg')
      }
    )
  }

  return (
    <div className="canvas-wrap" ref={wrapRef} onDoubleClick={addComponent}>
      <div className="canvas-toolbar" onDoubleClick={(e) => e.stopPropagation()}>
        <button className="small" onClick={addComponent}>
          <PlussIcon /> Componente
        </button>
        <button className="small" onClick={addGroup}>
          <PlussIcon /> Gruppo
        </button>
        <button className="small" onClick={autoLayout} title="Layout automatico (⌘L)">
          <LayoutIcon /> Layout
        </button>
        <button className="small" onClick={() => fitView({ padding: 0.18, duration: 350 })}>
          <FitIcon /> Adatta
        </button>
        <ZoomControls />
      </div>
      {!expansion && selection.nodeIds.length >= 2 && <MultiSelectBar nodeIds={selection.nodeIds} />}
      {expansion && data && (
        <div className="expansion-bar">
          <span className="eb-label">Sotto-grafo di</span>
          <strong>{data.model.nodes.find((n) => n.id === expansion.rootId)?.name ?? '?'}</strong>
          <span className="eb-sep" />
          <span className="eb-label">Profondità</span>
          {[1, 2, 3].map((d) => (
            <button key={d} className={`small ${expansion.depth === d ? 'primary' : ''}`} onClick={() => setExpansionDepth(d)}>
              {d} hop
            </button>
          ))}
          <span className="eb-sep" />
          <span className="eb-label">click = seleziona · E = ri-espandi · Esc = esci</span>
          <button className="small" onClick={closeExpansion}>Esci (Esc)</button>
        </div>
      )}
      {data && data.model.nodes.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty-card">
            <div className="ce-title">La canvas è vuota</div>
            <div className="ce-text">
              Doppio click qui (o tasto destro → «Aggiungi componente qui») per il primo componente.
              Poi trascina dal punto laterale di un nodo per collegarlo. Doppio click su un nodo apre
              la vista dettaglio.
            </div>
            <button className="primary" onClick={addComponent}>+ Primo componente</button>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes: NodeChange[]) => {
          onNodesChange(changes)
          if (data && changes.some((c) => c.type === 'position')) {
            const now = Date.now()
            if (now - lastBoxRefresh.current > 80) {
              lastBoxRefresh.current = now
              setNodes((nds) => refreshGroupBoxes(nds, data.model))
            }
          }
        }}
        onNodeDragStop={(_e, _n, dragged) => commitPositions(dragged)}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        onPaneClick={() => select([])}
        onEdgeClick={(_e, edge) => select([], [edge.id])}
        onNodeClick={(_e, node) => {
          if (node.id.startsWith(GROUP_PREFIX)) return
          const already = selection.nodeIds.includes(node.id)
          select(already ? selection.nodeIds : [node.id])
        }}
        onNodeDoubleClick={(_e, node) => {
          if (node.id.startsWith(GROUP_PREFIX)) return
          openDetail(node.id)
        }}
        onPaneContextMenu={onPaneCtx}
        onNodeContextMenu={onNodeCtx}
        onEdgeContextMenu={onEdgeCtx}
        onNodesDelete={(deleted) => {
          const real = deleted.filter((n) => !n.id.startsWith(GROUP_PREFIX))
          if (real.length > 0) void applyOps(real.map((n) => ({ op: 'delete_node', id: n.id })))
        }}
        onEdgesDelete={(deleted) => {
          if (deleted.length > 0) void applyOps(deleted.map((e) => ({ op: 'delete_relation', id: e.id })))
        }}
        deleteKeyCode={['Backspace']}
        multiSelectionKeyCode={['Meta']}
        selectionKeyCode={['Shift']}
        onlyRenderVisibleElements
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        panOnScroll
        zoomOnPinch
        minZoom={0.1}
        maxZoom={2.2}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <LodController wrapRef={wrapRef} />
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#232b3d" />
        {showMinimap && (
          <MiniMap
            className="canvas-minimap"
            pannable
            zoomable
            nodeBorderRadius={3}
            nodeStrokeWidth={2}
            nodeStrokeColor="#0b0e14"
            maskColor="rgba(11, 14, 20, 0.66)"
            nodeColor={(n) => {
              if (n.type === 'groupBox') return 'transparent'
              const d = n.data as ArchiNodeData
              return techColor(d?.node?.type ?? '', d?.node?.category)
            }}
          />
        )}
      </ReactFlow>
    </div>
  )
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

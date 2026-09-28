import { create } from 'zustand'
import { McpStatus } from '../../shared/types'
import {
  AiChatResult,
  AiContextRequest,
  AppSettings,
  ArtifactCategory,
  ChatMessage,
  Op,
  ProjectData,
  ProjectMeta,
  Proposal,
  ValidationIssue,
  VersionSnapshotMeta
} from '../../shared/types'
import { api } from './api'
import { buildPasteOps, extractClipboard, ClipboardContent } from './utils/paste'

export type CenterView =
  | { kind: 'canvas' }
  | { kind: 'artifact'; id: string }
  | { kind: 'detail'; id: string }
  | { kind: 'validation' }
  | { kind: 'versions' }

interface ChatEntry extends ChatMessage {
  id: string
  isError?: boolean
  streaming?: boolean
  proposal?: Proposal
  proposalStatus?: 'pending' | 'approved' | 'rejected'
}

interface UIStore {
  projects: ProjectMeta[]
  data: ProjectData | null
  modelVersion: number
  issues: ValidationIssue[]
  versions: VersionSnapshotMeta[]
  settings: AppSettings | null
  mcp: McpStatus | null
  pendingMcpProposals: Proposal[]
  selection: { nodeIds: string[]; relationIds: string[] }
  focusRequest: { nodeId: string; nonce: number } | null
  view: CenterView
  activeArtifactId: string | null
  chatOpen: boolean
  chatHeight: number
  chatMessages: ChatEntry[]
  chatBusy: boolean
  settingsOpen: boolean
  welcomeOverride: boolean
  paletteOpen: boolean
  input: { open: boolean; title: string; value: string } | null
  clipboard: ClipboardContent | null
  lastSavedAt: number | null
  onboardingOpen: boolean
  help: { open: boolean; tab: string } | null
  snapToGrid: boolean
  showMinimap: boolean
  searchQuery: string
  selectionNonce: number
  expansion: { rootId: string; depth: number } | null
  collapsed: Record<string, boolean>
  editingNodeId: string | null
  techPickerNodeId: string | null
  showExplorer: boolean
  showInspector: boolean
  canUndo: boolean
  canRedo: boolean
  canvasCmd: { cmd: 'zoom-in' | 'zoom-out' | 'zoom-reset' | 'fit' | 'auto-layout'; nonce: number } | null
  searchFocusNonce: number
  toast: { text: string; nonce: number; action?: { label: string; run: () => void } } | null

  boot: () => Promise<void>
  refreshProjects: () => Promise<void>
  refreshServerState: () => Promise<void>
  createProject: (name: string, description: string) => Promise<void>
  openProject: (id: string) => Promise<void>
  switchProject: (id: string) => Promise<void>
  openDemo: () => Promise<void>
  importProject: () => Promise<void>
  deleteProject: (id: string) => Promise<void>
  applyOps: (ops: Op[], source?: string) => Promise<boolean>
  select: (nodeIds: string[], relationIds?: string[]) => void
  focusNode: (nodeId: string) => void
  setView: (v: CenterView) => void
  openArtifact: (id: string) => void
  openDetail: (id: string) => void
  generateArtifact: (category: ArtifactCategory, nodeId?: string, title?: string) => Promise<void>
  runValidation: () => Promise<void>
  refreshVersions: () => Promise<void>
  createVersion: (label: string) => Promise<void>
  restoreVersion: (id: string) => Promise<void>
  setChatOpen: (open: boolean) => void
  setChatHeight: (h: number) => void
  sendChat: (text: string) => Promise<void>
  appendChatDelta: (delta: string) => void
  voteAiProposal: (msgId: string, vote: 'approved' | 'rejected') => Promise<void>
  voteMcpProposal: (id: string, vote: 'approved' | 'rejected') => Promise<void>
  setSettingsOpen: (open: boolean) => void
  saveSettings: (s: AppSettings) => Promise<void>
  showToast: (text: string, action?: { label: string; run: () => void }) => void
  exportFile: (format: 'json' | 'mermaid' | 'svg' | 'png') => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  requestInput: (title: string, value?: string) => Promise<string | null>
  submitInput: (value: string | null) => void
  copySelection: () => void
  cutSelection: () => Promise<void>
  pasteClipboard: () => Promise<void>
  completeOnboarding: () => Promise<void>
  reopenOnboarding: () => void
  openHelp: (tab?: string) => void
  closeHelp: () => void
  toggleSnap: () => void
  toggleMinimap: () => void
  setSearchQuery: (q: string) => void
  expandNode: (id: string, depth?: number) => void
  setExpansionDepth: (d: number) => void
  closeExpansion: () => void
  toggleCollapsed: (id: string) => void
  setEditingNodeId: (id: string | null) => void
  openTechPicker: (id: string) => void
  setAllCollapsed: (collapsed: boolean) => void
  setPaletteOpen: (open: boolean) => void
  setWelcomeOverride: (open: boolean) => void
  toggleExplorer: () => void
  toggleInspector: () => void
  runCanvasCmd: (cmd: 'zoom-in' | 'zoom-out' | 'zoom-reset' | 'fit' | 'auto-layout') => void
  focusSearch: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

// timestamp dell'ultima select programmatica: serve alla canvas per ignorare l'eco vuota di RF
let _selectTs = 0
export const getLastSelectTs = (): number => _selectTs

// guida contestuale: un suggerimento per azione chiave, una sola volta per sessione
const coached = new Set<string>()
function coach(key: string, tip: string, show: (t: string) => void): void {
  if (coached.has(key)) return
  coached.add(key)
  setTimeout(() => show(tip), 600)
}
let inputResolver: ((v: string | null) => void) | null = null
let pasteCounter = 0

export const useStore = create<UIStore>((set, get) => ({
  projects: [],
  data: null,
  modelVersion: 0,
  issues: [],
  versions: [],
  settings: null,
  mcp: null,
  pendingMcpProposals: [],
  selection: { nodeIds: [], relationIds: [] },
  focusRequest: null,
  view: { kind: 'canvas' },
  activeArtifactId: null,
  chatOpen: true,
  chatHeight: 300,
  chatMessages: [],
  chatBusy: false,
  settingsOpen: false,
  welcomeOverride: false,
  paletteOpen: false,
  input: null,
  clipboard: null,
  lastSavedAt: null,
  onboardingOpen: false,
  help: null,
  snapToGrid: false,
  showMinimap: true,
  searchQuery: '',
  selectionNonce: 0,
  expansion: null,
  collapsed: {},
  editingNodeId: null,
  techPickerNodeId: null,
  showExplorer: true,
  showInspector: true,
  canUndo: false,
  canRedo: false,
  canvasCmd: null,
  searchFocusNonce: 0,
  toast: null,

  boot: async () => {
    await get().refreshProjects()
    const settings = await api.settings.get()
    set({ settings, onboardingOpen: !settings.onboardingDone })
    await get().refreshServerState()
    const list = await api.projects.list()
    if (list.length > 0) await get().openProject(list[0].id)
  },

  refreshProjects: async () => set({ projects: await api.projects.list() }),

  refreshServerState: async () => {
    const [mcp, proposals] = await Promise.all([
      api.mcp.status(),
      get().data ? api.proposals.list() : Promise.resolve([])
    ])
    set({ mcp, pendingMcpProposals: proposals.filter((p) => p.status === 'pending') })
  },

  createProject: async (name, description) => {
    const meta = await api.projects.create(name, description)
    await get().refreshProjects()
    await get().openProject(meta.id)
  },

  switchProject: async (id) => {
    // come openProject ma senza toccare welcomeOverride: switch rapido dall'app aperta
    const data = await api.projects.open(id)
    set({
      data,
      modelVersion: get().modelVersion + 1,
      selection: { nodeIds: [], relationIds: [] },
      view: { kind: 'canvas' },
      activeArtifactId: null,
      chatMessages: [],
      issues: [],
      versions: [],
      lastSavedAt: Date.now(),
      collapsed: {}
    })
    await Promise.all([get().runValidation(), get().refreshVersions(), get().refreshServerState()])
    const name = data.meta.name
    get().showToast(`Progetto: ${name}`)
  },

  openProject: async (id) => {
    const data = await api.projects.open(id)
    set({
      data,
      modelVersion: get().modelVersion + 1,
      selection: { nodeIds: [], relationIds: [] },
      view: { kind: 'canvas' },
      activeArtifactId: null,
      chatMessages: [],
      issues: [],
      versions: [],
      welcomeOverride: false,
      lastSavedAt: Date.now()
    })
    get().setAllCollapsed(true)
    await Promise.all([get().runValidation(), get().refreshVersions(), get().refreshServerState()])
  },

  importProject: async () => {
    const meta = await api.projects.importJson()
    if (!meta) return // dialog annullata
    await get().refreshProjects()
    await get().openProject(meta.id)
    get().showToast(`Progetto importato: ${meta.name}`)
  },

  openDemo: async () => {
    const data = await api.projects.demo()
    set({
      data,
      modelVersion: get().modelVersion + 1,
      selection: { nodeIds: [], relationIds: [] },
      view: { kind: 'canvas' },
      chatMessages: []
    })
    await Promise.all([get().refreshProjects(), get().runValidation(), get().refreshVersions()])
  },

  deleteProject: async (id) => {
    await api.projects.delete(id)
    if (get().data?.meta.id === id) set({ data: null })
    await get().refreshProjects()
  },

  applyOps: async (ops, source = 'ui') => {
    const res = await api.ops.apply(ops, source)
    if (!res.ok) {
      get().showToast(res.error ?? 'Operazione fallita')
      return false
    }
    if (res.model && get().data) {
      set((s) => ({
        data: { meta: res.meta ?? s.data!.meta, model: res.model! },
        modelVersion: s.modelVersion + 1,
        canUndo: res.canUndo ?? true,
        canRedo: res.canRedo ?? false,
        lastSavedAt: Date.now()
      }))
      const showToast = get().showToast
      if (ops.some((o) => o.op === 'create_node')) {
        const created = ops.find((o) => o.op === 'create_node' && typeof (o as { node?: { id?: string } }).node?.id === 'string')
        const createdId = created ? (created as { node: { id: string } }).node.id : get().selection.nodeIds[0]
        coach('create_node', 'Componente creato — scegli la sua tecnologia per icona e colore', (t) =>
          showToast(t, {
            label: 'Scegli…',
            run: () => {
              if (createdId) get().openTechPicker(createdId)
            }
          }))
      }
      if (ops.some((o) => o.op === 'create_relation')) {
        coach('create_relation', 'Collegamento creato — tasto destro sulla freccia per cambiare tipo (REST, DB, coda…) e protocollo', showToast)
      }
      if (ops.some((o) => o.op === 'create_group')) {
        coach('create_group', 'Gruppo creato — assegnagli i componenti dal tasto destro di un nodo → Sposta in «gruppo»', showToast)
      }
    }
    void get().runValidation()
    return true
  },

  undo: async () => {
    const res = await api.ops.undo()
    if (res.ok && res.model && get().data) {
      set((s) => ({
        data: { meta: res.meta ?? s.data!.meta, model: res.model! },
        modelVersion: s.modelVersion + 1,
        canUndo: res.canUndo ?? false,
        canRedo: res.canRedo ?? true,
        lastSavedAt: Date.now()
      }))
      void get().runValidation()
    } else if (!res.ok && res.error && res.error !== 'niente da annullare') {
      get().showToast(res.error)
    }
  },

  redo: async () => {
    const res = await api.ops.redo()
    if (res.ok && res.model && get().data) {
      set((s) => ({
        data: { meta: res.meta ?? s.data!.meta, model: res.model! },
        modelVersion: s.modelVersion + 1,
        canUndo: res.canUndo ?? true,
        canRedo: res.canRedo ?? false,
        lastSavedAt: Date.now()
      }))
      void get().runValidation()
    } else if (!res.ok && res.error && res.error !== 'niente da ripetere') {
      get().showToast(res.error)
    }
  },

  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setWelcomeOverride: (open) => set({ welcomeOverride: open }),
  toggleExplorer: () => set((s) => ({ showExplorer: !s.showExplorer })),
  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),

  runCanvasCmd: (cmd) =>
    set((s) => ({ canvasCmd: { cmd, nonce: (s.canvasCmd?.nonce ?? 0) + 1 } })),

  focusSearch: () => set((s) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),

  select: (nodeIds, relationIds = []) => {
    _selectTs = Date.now()
    set((s) => ({
      selection: { nodeIds, relationIds },
      selectionNonce: s.selectionNonce + 1,
      editingNodeId: s.editingNodeId && !nodeIds.includes(s.editingNodeId) ? null : s.editingNodeId
    }))
  },

  focusNode: (nodeId) =>
    set((s) => ({
      selection: { nodeIds: [nodeId], relationIds: [] },
      view: { kind: 'canvas' },
      focusRequest: { nodeId, nonce: (s.focusRequest?.nonce ?? 0) + 1 }
    })),

  setView: (v) => set({ view: v }),

  openArtifact: (id) => set({ view: { kind: 'artifact', id }, activeArtifactId: id }),

  openDetail: (id) =>
    set((s) => ({ view: { kind: 'detail', id }, selection: { nodeIds: [id], relationIds: [] }, focusRequest: { nodeId: id, nonce: (s.focusRequest?.nonce ?? 0) + 1 } })),

  generateArtifact: async (category, nodeId, title) => {
    const res = await api.artifacts.generate(category, nodeId, title)
    if (!res.ok || !res.artifact) {
      get().showToast(res.error ?? 'Generation failed')
      return
    }
    await get().refreshServerState()
    get().openArtifact(res.artifact.id)
  },

  runValidation: async () => set({ issues: await api.validate() }),

  refreshVersions: async () => {
    if (get().data) set({ versions: await api.versions.list() })
  },

  createVersion: async (label) => {
    await api.versions.create(label)
    get().showToast(`Versione salvata: ${label}`)
    await get().refreshVersions()
  },

  restoreVersion: async (id) => {
    const res = await api.versions.restore(id)
    if (!res.ok) {
      get().showToast(res.error ?? 'Ripristino fallito')
      return
    }
    set((s) => ({
      data: { meta: res.meta ?? s.data!.meta, model: res.model! },
      modelVersion: s.modelVersion + 1,
      selection: { nodeIds: [], relationIds: [] }
    }))
    get().showToast('Versione ripristinata')
    await get().runValidation()
  },

  setChatOpen: (open) => set({ chatOpen: open }),
  setChatHeight: (h) => set({ chatHeight: Math.max(160, Math.min(560, h)) }),

  sendChat: async (text) => {
    if (!text.trim() || get().chatBusy) return
    const userEntry: ChatEntry = { id: `m_${Date.now()}`, role: 'user', content: text.trim() }
    const streamId = `m_${Date.now()}s`
    set((s) => ({
      chatMessages: [...s.chatMessages, userEntry, { id: streamId, role: 'assistant', content: '', streaming: true }],
      chatBusy: true
    }))
    const history: ChatMessage[] = [...get().chatMessages]
      .filter((m) => !m.streaming && !m.isError)
      .map(({ role, content }) => ({ role, content }))
    // contesto automatico: se c'è una selezione la usa (con i vicini), altrimenti tutto il progetto
    const selection: AiContextRequest = {
      nodeIds: get().selection.nodeIds,
      wholeProject: get().selection.nodeIds.length === 0
    }
    const res: AiChatResult = await api.ai.chat(history, selection)
    if (res.error) {
      set((s) => ({
        chatBusy: false,
        chatMessages: [
          ...s.chatMessages.filter((m) => m.id !== streamId),
          { id: `m_${Date.now()}e`, role: 'assistant', content: res.error!, isError: true }
        ]
      }))
      return
    }
    set((s) => ({
      chatBusy: false,
      chatMessages: s.chatMessages.map((m) =>
        m.id === streamId
          ? {
              ...m,
              streaming: false,
              content: res.reply || '(nessuna risposta dal modello)',
              proposal: res.proposal,
              proposalStatus: res.proposal ? ('pending' as const) : undefined
            }
          : m
      )
    }))
  },

  appendChatDelta: (delta) =>
    set((s) => ({
      chatMessages: s.chatMessages.map((m) => (m.streaming ? { ...m, content: m.content + delta } : m))
    })),

  voteAiProposal: async (msgId, vote) => {
    const msg = get().chatMessages.find((m) => m.id === msgId)
    if (!msg?.proposal || msg.proposalStatus !== 'pending') return
    if (vote === 'approved') {
      const ok = await get().applyOps(msg.proposal.ops, 'ai')
      if (!ok) return
      get().showToast('Modifiche applicate')
    }
    set((s) => ({
      chatMessages: s.chatMessages.map((m) => (m.id === msgId ? { ...m, proposalStatus: vote } : m))
    }))
  },

  voteMcpProposal: async (id, vote) => {
    if (vote === 'approved') {
      const res = await api.proposals.approve(id)
      if (!res.ok) {
        get().showToast(res.error ?? 'Operazione fallita')
        return
      }
      if (res.model && get().data) {
        set((s) => ({
          data: { meta: res.meta ?? s.data!.meta, model: res.model! },
          modelVersion: s.modelVersion + 1
        }))
      }
      get().showToast('Proposta MCP applicata')
    } else {
      const res = await api.proposals.reject(id)
      if (!res.ok) {
        get().showToast(res.error ?? 'Operazione fallita')
        return
      }
      get().showToast('Proposta MCP rifiutata')
    }
    await get().refreshServerState()
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  saveSettings: async (s) => {
    const next = await api.settings.set(s)
    set({ settings: next })
    get().showToast('Impostazioni salvate')
    await get().refreshServerState()
  },

  completeOnboarding: async () => {
    set({ onboardingOpen: false })
    const s = get().settings
    if (s) {
      const next = { ...s, onboardingDone: true }
      set({ settings: await api.settings.set(next) })
    }
  },

  reopenOnboarding: () => set({ onboardingOpen: true }),

  openHelp: (tab = 'guide') => set({ help: { open: true, tab } }),
  closeHelp: () => set({ help: null }),
  expandNode: (id, depth = 2) => {
    set({ expansion: { rootId: id, depth }, view: { kind: 'canvas' } })
    coach('expand', 'Sei nel sotto-grafo: 1/2/3 hop per l\'ampiezza, click su un altro nodo e premi E per saltare lì, Esc per uscire', get().showToast)
  },
  setExpansionDepth: (d) => set((s) => (s.expansion ? { expansion: { ...s.expansion, depth: d } } : {})),
  closeExpansion: () => set({ expansion: null }),
  toggleCollapsed: (id) => set((s) => {
    const c = { ...s.collapsed }
    if (c[id]) delete c[id]
    else c[id] = true
    return { collapsed: c }
  }),

  setEditingNodeId: (id) => set({ editingNodeId: id }),
  openTechPicker: (id) => set({ techPickerNodeId: id, selection: { nodeIds: [id], relationIds: [] } }),

  // true = vista sistema (tutti i padri decomposti collassati) · false = vista completa
  setAllCollapsed: (want) => set((s) => {
    if (!s.data) return {}
    const parents = new Set(
      s.data.model.relations.filter((r) => r.type === 'component').map((r) => r.sourceId)
    )
    if (!want) return { collapsed: {} }
    const c: Record<string, boolean> = {}
    for (const id of parents) c[id] = true
    return { collapsed: c }
  }),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  setSearchQuery: (q) => set({ searchQuery: q }),

  requestInput: (title, value = '') =>
    new Promise<string | null>((resolve) => {
      inputResolver = resolve
      set({ input: { open: true, title, value } })
    }),

  submitInput: (value) => {
    inputResolver?.(value)
    inputResolver = null
    set({ input: null })
  },

  copySelection: () => {
    const data = get().data
    if (!data) return
    const clip = extractClipboard(data.model, get().selection.nodeIds)
    if (!clip) {
      get().showToast('Seleziona almeno un componente da copiare')
      return
    }
    set({ clipboard: clip })
    get().showToast(`${clip.nodes.length} componenti copiati`)
  },

  cutSelection: async () => {
    const data = get().data
    if (!data) return
    const ids = get().selection.nodeIds
    const clip = extractClipboard(data.model, ids)
    if (!clip) {
      get().showToast('Seleziona almeno un componente da tagliare')
      return
    }
    set({ clipboard: clip })
    await get().applyOps(ids.map((id) => ({ op: 'delete_node', id })))
  },

  pasteClipboard: async () => {
    const clip = get().clipboard
    if (!clip || clip.nodes.length === 0) {
      get().showToast('Clipboard vuoto: copia prima alcuni componenti')
      return
    }
    pasteCounter += 1
    const suffix = ` (copia${pasteCounter > 1 ? ` ${pasteCounter}` : ''})`
    const renamed = {
      nodes: clip.nodes.map((n) => ({ ...n, name: `${n.name}${suffix}` })),
      relations: clip.relations
    }
    const { ops, pastedIds } = buildPasteOps(renamed, { x: 36 * pasteCounter, y: 36 * pasteCounter })
    const ok = await get().applyOps(ops)
    if (ok) {
      get().select(pastedIds)
      get().showToast(`${pastedIds.length} componenti incollati`)
    }
  },

  showToast: (text, action) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: { text, nonce: Date.now(), action } })
    toastTimer = setTimeout(() => set({ toast: null }), action ? 6000 : 3200)
  },

  exportFile: async (format) => {
    const p = await api.exportFile(format)
    if (p) get().showToast(`Esportato: ${p}`)
  }
}))

// hook per smoke test e debugging
;(window as unknown as Record<string, unknown>).__archi = useStore

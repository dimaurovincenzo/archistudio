import { ipcMain, dialog, shell, app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron'
import { safeStorage } from 'electron'
import fs from 'node:fs/promises'
import { watch as nodeWatch } from 'node:fs'
import path from 'node:path'
import { ProjectManager } from './projects'
import { loadSettings, saveSettings } from './settings'
import { applyOps } from './ops'
import { validateModel } from './validation'
import { createSnapshot, listSnapshots, readSnapshot } from './versioning'
import { generateArtifactContent } from './templates'
import { runAiTurn } from './ai/agent'
import { startHttpMcp, HttpMcpHandle } from './mcp/http'
import { MCP_TOOLS, MCP_RESOURCES } from './mcp/catalog'
import { seedDemoProject } from './demo'
import { exportJson, exportMermaid } from './export'
import { exportSvg } from './export-svg'
import { AiContextRequest, AppSettings, ArchiModel, ArtifactCategory, ChatMessage, CtxItem, Op, Proposal } from '../shared/types'

let httpHandle: HttpMcpHandle | null = null
let watcher: { close(): void } | null = null
let suppressUntil = 0

type GetWin = () => BrowserWindow | null

// ---- undo/redo (model snapshots per project) ---------------------------------

const MAX_UNDO = 60
const undoStacks = new Map<string, { undo: ArchiModel[]; redo: ArchiModel[] }>()

function stacksFor(id: string): { undo: ArchiModel[]; redo: ArchiModel[] } {
  let s = undoStacks.get(id)
  if (!s) {
    s = { undo: [], redo: [] }
    undoStacks.set(id, s)
  }
  return s
}

function undoStatus(manager: ProjectManager): { canUndo: boolean; canRedo: boolean } {
  if (!manager.current) return { canUndo: false, canRedo: false }
  const st = stacksFor(manager.current.meta.id)
  return { canUndo: st.undo.length > 0, canRedo: st.redo.length > 0 }
}

function notifyChanged(getWin: GetWin): void {
  getWin()?.webContents.send('project-changed')
}

async function persistAndNotify(
  manager: ProjectManager,
  getWin: GetWin,
  touched?: { nodes?: Set<string>; relations?: Set<string>; groups?: Set<string>; artifacts?: Set<string> }
): Promise<void> {
  suppressUntil = Date.now() + 800
  await manager.store.persist(touched)
  notifyChanged(getWin)
}

function startWatcher(manager: ProjectManager, getWin: GetWin): void {
  stopWatcher()
  let timer: NodeJS.Timeout | null = null
  try {
    const w = nodeWatch(manager.store.dir, { recursive: true }, () => {
      if (Date.now() < suppressUntil) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void manager.store
          .reload()
          .then(() => notifyChanged(getWin))
          .catch(() => {})
      }, 350)
    })
    watcher = { close: () => w.close() }
  } catch {
    /* watcher optional */
  }
}

function stopWatcher(): void {
  watcher?.close()
  watcher = null
}

async function listOnDiskProposals(manager: ProjectManager): Promise<Proposal[]> {
  const dir = path.join(manager.store.dir, '.archi', 'proposals')
  const files = await fs.readdir(dir).catch(() => [])
  const out: Proposal[] = []
  for (const f of files.filter((x) => x.endsWith('.json'))) {
    try {
      out.push(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')))
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function writeProposalFile(manager: ProjectManager, p: Proposal): Promise<void> {
  const file = path.join(manager.store.dir, '.archi', 'proposals', `${p.id}.json`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(p), 'utf8')
}

export function registerIpc(manager: ProjectManager, getWin: GetWin): void {
  const requireStore = () => {
    if (!manager.current) throw new Error('No project open')
    return manager.store
  }

  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }))

  ipcMain.handle('projects:list', () => manager.listProjects())
  ipcMain.handle('projects:create', (_e, name: string, description: string) =>
    manager.createProject(name, description ?? '')
  )
  ipcMain.handle('projects:open', async (_e, id: string) => {
    const data = await manager.openProject(id)
    undoStacks.delete(id)
    startWatcher(manager, getWin)
    getWin()?.setTitle(`${data.meta.name} — ArchiStudio`)
    return { ...data, ...undoStatus(manager) }
  })
  ipcMain.handle('projects:delete', async (_e, id: string) => {
    await manager.deleteProject(id)
    return true
  })
  ipcMain.handle('projects:demo', async () => {
    const meta = await seedDemoProject(manager)
    const data = await manager.openProject(meta.id)
    startWatcher(manager, getWin)
    return data
  })

  ipcMain.handle('project:get', () => {
    const s = requireStore()
    return { meta: s.meta, model: s.model }
  })

  ipcMain.handle('ops:apply', async (_e, ops: Op[], source: string) => {
    const s = requireStore()
    if (!Array.isArray(ops) || ops.length === 0) return { ok: false, error: 'no ops' }
    if (source !== 'ui') {
      await createSnapshot(s, s.model, `Before ${source} change`, source === 'mcp' ? 'mcp' : 'ai')
    }
    // record state for undo before mutating
    const st = stacksFor(s.meta.id)
    st.undo.push(structuredClone(s.model))
    if (st.undo.length > MAX_UNDO) st.undo.shift()
    st.redo = []
    const res = applyOps(s.model, ops)
    if (!res.ok) {
      st.undo.pop()
      return { ...res, ...undoStatus(manager) }
    }
    await persistAndNotify(manager, getWin, res.touched)
    return { ok: true, model: s.model, meta: s.meta, ...undoStatus(manager) }
  })

  ipcMain.handle('ops:undo', async () => {
    const s = requireStore()
    const st = stacksFor(s.meta.id)
    if (st.undo.length === 0) return { ok: false, error: 'nothing to undo', ...undoStatus(manager) }
    st.redo.push(structuredClone(s.model))
    s.model = st.undo.pop()!
    await persistAndNotify(manager, getWin)
    return { ok: true, model: s.model, meta: s.meta, ...undoStatus(manager) }
  })

  ipcMain.handle('ops:redo', async () => {
    const s = requireStore()
    const st = stacksFor(s.meta.id)
    if (st.redo.length === 0) return { ok: false, error: 'nothing to redo', ...undoStatus(manager) }
    st.undo.push(structuredClone(s.model))
    s.model = st.redo.pop()!
    await persistAndNotify(manager, getWin)
    return { ok: true, model: s.model, meta: s.meta, ...undoStatus(manager) }
  })

  // ---- native context menus ----------------------------------------------------

  ipcMain.handle('ctx:show', (_e, items: CtxItem[]) =>
    new Promise<string | null>((resolve) => {
      let picked: string | null = null
      const tpl: MenuItemConstructorOptions[] = (items ?? []).map((i) =>
        i.type === 'separator'
          ? { type: 'separator' }
          : {
              label: i.label,
              enabled: i.enabled !== false,
              accelerator: i.accelerator,
              click: () => {
                picked = i.id ?? null
              }
            }
      )
      const menu = Menu.buildFromTemplate(tpl)
      menu.popup({
        callback: () => setTimeout(() => resolve(picked), 10)
      })
    })
  )

  ipcMain.handle('validate', () => validateModel(requireStore().model))

  ipcMain.handle(
    'artifact:generate',
    async (_e, category: ArtifactCategory, nodeId?: string, customTitle?: string) => {
      const s = requireStore()
      let gen
      try {
        gen = generateArtifactContent(s.model, category, { nodeId, title: customTitle })
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
      const res = applyOps(s.model, [
        { op: 'create_artifact', artifact: { ...gen, category, derived: 'template' } }
      ])
      if (!res.ok) return { ok: false, error: res.error }
      await persistAndNotify(manager, getWin)
      const created = s.model.artifacts[s.model.artifacts.length - 1]
      return { ok: true, artifact: created }
    }
  )

  ipcMain.handle('versions:list', () => listSnapshots(requireStore()))
  ipcMain.handle('versions:create', async (_e, label: string) => {
    const s = requireStore()
    const snap = await createSnapshot(s, s.model, label, 'manual')
    await persistAndNotify(manager, getWin)
    return snap
  })
  ipcMain.handle('versions:restore', async (_e, id: string) => {
    const s = requireStore()
    const snap = await readSnapshot(s, id)
    if (!snap) return { ok: false, error: 'version not found' }
    const st = stacksFor(s.meta.id)
    st.undo.push(structuredClone(s.model))
    if (st.undo.length > MAX_UNDO) st.undo.shift()
    st.redo = []
    await createSnapshot(s, s.model, 'Auto-snapshot before restore', 'manual')
    s.model = structuredClone(snap.model)
    await persistAndNotify(manager, getWin)
    return { ok: true, model: s.model, meta: s.meta, ...undoStatus(manager) }
  })

  ipcMain.handle('export:file', async (_e, format: 'json' | 'mermaid' | 'svg') => {
    const s = requireStore()
    const ext = format === 'json' ? 'json' : format === 'svg' ? 'svg' : 'mmd'
    const win = getWin()
    const res = await dialog.showSaveDialog(win!, {
      title: `Esporta ${format.toUpperCase()}`,
      defaultPath: path.join(app.getPath('documents'), `${s.meta.name}.${ext}`),
      filters: [{ name: format, extensions: [ext] }]
    })
    if (res.canceled || !res.filePath) return null
    const data =
      format === 'json'
        ? exportJson(s.model, { name: s.meta.name, description: s.meta.description })
        : format === 'svg'
          ? exportSvg(s.model, s.meta.name)
          : exportMermaid(s.model)
    await fs.writeFile(res.filePath, data, 'utf8')
    return res.filePath
  })

  ipcMain.handle('ai:chat', async (_e, history: ChatMessage[], selection: AiContextRequest) => {
    const s = requireStore()
    const settings = manager.settings
    if (!settings.ai.baseUrl) return { reply: '', error: 'AI non configurata: apri le Impostazioni.' }
    const win = getWin()
    return runAiTurn(settings.ai, s.model, selection, history ?? [], (delta) => {
      win?.webContents.send('ai:delta', delta)
    })
  })

  ipcMain.handle('proposals:list', () => listOnDiskProposals(manager))
  ipcMain.handle('proposals:approve', async (_e, id: string) => {
    const s = requireStore()
    const all = await listOnDiskProposals(manager)
    const p = all.find((x) => x.id === id)
    if (!p) return { ok: false, error: 'proposal not found' }
    if (p.status !== 'pending') return { ok: false, error: `proposal already ${p.status}` }
    await createSnapshot(s, s.model, `Before applying proposal "${p.title}"`, p.source === 'mcp' ? 'mcp' : 'ai')
    const res = applyOps(s.model, p.ops)
    if (!res.ok) return { ok: false, error: res.error }
    p.status = 'approved'
    p.ops = []
    await writeProposalFile(manager, p)
    await persistAndNotify(manager, getWin)
    return { ok: true, model: s.model, meta: s.meta }
  })
  ipcMain.handle('proposals:reject', async (_e, id: string) => {
    const all = await listOnDiskProposals(manager)
    const p = all.find((x) => x.id === id)
    if (!p) return { ok: false, error: 'proposal not found' }
    p.status = 'rejected'
    p.ops = []
    await writeProposalFile(manager, p)
    return { ok: true }
  })

  // al renderer la chiave non torna mai: solo il flag "stored"
  ipcMain.handle('settings:get', (): AppSettings => ({
    ...manager.settings,
    ai: {
      ...manager.settings.ai,
      apiKey: '',
      apiKeyEnc: undefined,
      apiKeyStored: Boolean(manager.settings.ai.apiKeyEnc || manager.settings.ai.apiKey)
    }
  }))
  ipcMain.handle('settings:set', async (_e, next: AppSettings) => {
    const cur = manager.settings
    if (next.ai.apiKey) {
      // chiave nuova (o sostituzione): verrà cifrata in saveSettings
      next.ai.apiKeyEnc = undefined
      next.ai.apiKeyStored = true
    } else {
      // campo lasciato vuoto → preserva la chiave esistente (criptata o legacy in chiaro)
      next.ai.apiKeyEnc = cur.ai.apiKeyEnc
      next.ai.apiKey = cur.ai.apiKey
      next.ai.apiKeyStored = Boolean(cur.ai.apiKeyEnc || cur.ai.apiKey)
    }
    manager.settings = next
    await saveSettings(next)
    return {
      ...next,
      ai: { ...next.ai, apiKey: '', apiKeyEnc: undefined, apiKeyStored: Boolean(next.ai.apiKeyEnc || cur.ai.apiKey) }
    }
  })

  ipcMain.handle('mcp:status', () => ({
    mode: manager.settings.mcp.mode,
    httpRunning: Boolean(httpHandle),
    httpPort: httpHandle?.port ?? manager.settings.mcp.httpPort,
    token: manager.settings.mcp.token,
    projectsRoot: manager.settings.projectsRoot,
    stdioScript: app.isPackaged
      ? path.join(process.resourcesPath, 'mcp', 'index.js')
      : path.join(app.getAppPath(), 'out', 'mcp', 'index.js'),
    httpUrl: `http://127.0.0.1:${httpHandle?.port ?? manager.settings.mcp.httpPort}/mcp`,
    projectDir: manager.current?.dir ?? '',
    packaged: app.isPackaged
  }))
  ipcMain.handle('mcp:catalog', () => ({ tools: MCP_TOOLS, resources: MCP_RESOURCES }))
  ipcMain.handle('mcp:http:start', async () => {
    if (httpHandle) return { ok: true, port: httpHandle.port }
    const s = requireStore()
    httpHandle = await startHttpMcp({
      store: s,
      mode: manager.settings.mcp.mode,
      token: manager.settings.mcp.token,
      port: manager.settings.mcp.httpPort
    })
    return { ok: true, port: httpHandle.port }
  })
  ipcMain.handle('mcp:http:stop', async () => {
    await httpHandle?.close()
    httpHandle = null
    return { ok: true }
  })

  ipcMain.handle('dialog:choose-dir', async () => {
    const res = await dialog.showOpenDialog(getWin()!, {
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle('app:reveal-projects', async () => {
    await manager.ensureRoot()
    return shell.openPath(manager.settings.projectsRoot)
  })
  ipcMain.handle('app:reveal-project', async () => shell.openPath(requireStore().dir))
}

export function cleanupIpc(): void {
  stopWatcher()
  void httpHandle?.close()
  httpHandle = null
}

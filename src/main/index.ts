import { app, BrowserWindow, dialog, Menu, MenuItemConstructorOptions, nativeImage, shell } from 'electron'
import fs from 'node:fs/promises'
import { appendFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadSettings } from './settings'
import { ProjectManager } from './projects'
import { registerIpc, cleanupIpc } from './ipc'
import { seedDemoProject } from './demo'
import { loadWindowState, trackWindowState } from './window-state'

const isSmoke = process.argv.includes('--smoke')
const isMac = process.platform === 'darwin'

// userData dedicato per smoke/debug: mai in conflitto con l'app dell'utente (lock e dati)
if (process.env.ARCHI_USER_DATA) {
  app.setPath('userData', process.env.ARCHI_USER_DATA)
} else if (isSmoke) {
  app.setPath('userData', '/tmp/archistudio-smoke-userdata')
}
let win: BrowserWindow | null = null

// una sola istanza: due app che scrivono lo stesso progetto = corruzione
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

// crash log persistente + dialog visibile (mai muta)
function logPath(): string {
  try {
    return path.join(app.getPath('userData'), 'archistudio.log')
  } catch {
    return '/tmp/archistudio.log'
  }
}
function appendLog(line: string): void {
  try {
    appendFileSync(logPath(), `[${new Date().toISOString()}] ${line}\n`, 'utf8')
  } catch {
    /* best effort */
  }
}
process.on('uncaughtException', (e) => {
  appendLog(`uncaughtException: ${e?.stack ?? e}`)
  try {
    dialog.showErrorBox('ArchiStudio — errore inatteso', String(e?.message ?? e))
  } catch {
    /* niente dialog prima di app ready */
  }
})
process.on('unhandledRejection', (e) => {
  appendLog(`unhandledRejection: ${String(e)}`)
})

function sendAction(id: string): void {
  win?.webContents.send('menu-action', id)
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const, label: `Info su ${app.name}` },
              { type: 'separator' as const },
              { label: 'Impostazioni…', accelerator: 'Cmd+,', click: () => sendAction('settings') },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'Nuovo progetto…', accelerator: 'CmdOrCtrl+N', click: () => sendAction('new-project') },
        { label: 'Cambia progetto…', accelerator: 'CmdOrCtrl+P', click: () => sendAction('open-project') },
        { label: 'Importa progetto da JSON…', accelerator: 'CmdOrCtrl+I', click: () => sendAction('import-json') },
        { label: 'Apri cartella progetti', accelerator: 'CmdOrCtrl+O', click: () => sendAction('open-projects') },
        { type: 'separator' },
        { label: 'Salva versione…', accelerator: 'CmdOrCtrl+S', click: () => sendAction('save-version') },
        { type: 'separator' },
        { label: 'Esporta JSON…', accelerator: 'CmdOrCtrl+E', click: () => sendAction('export-json') },
        { label: 'Esporta Mermaid…', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendAction('export-mermaid') },
        { label: 'Esporta SVG…', accelerator: 'CmdOrCtrl+Shift+G', click: () => sendAction('export-svg') },
        { label: 'Esporta PNG…', accelerator: 'CmdOrCtrl+Shift+P', click: () => sendAction('export-png') },
        { type: 'separator' },
        { label: 'Mostra progetto nel Finder', accelerator: 'Shift+CmdOrCtrl+R', click: () => sendAction('reveal-project') },
        ...(isMac ? [] : [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'quit' as const }])
      ]
    },
    {
      label: 'Modifica',
      submenu: [
        { label: 'Annulla', accelerator: 'CmdOrCtrl+Z', click: () => sendAction('undo') },
        { label: 'Ripeti', accelerator: 'CmdOrCtrl+Shift+Z', click: () => sendAction('redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Copia componenti', accelerator: 'Shift+CmdOrCtrl+C', click: () => sendAction('copy-nodes') },
        { label: 'Taglia componenti', accelerator: 'Shift+CmdOrCtrl+X', click: () => sendAction('cut-nodes') },
        { label: 'Incolla componenti', accelerator: 'Shift+CmdOrCtrl+V', click: () => sendAction('paste-nodes') },
        { type: 'separator' },
        { label: 'Cerca…', accelerator: 'CmdOrCtrl+F', click: () => sendAction('find') },
        { label: 'Palette comandi…', accelerator: 'CmdOrCtrl+K', click: () => sendAction('palette') }
      ]
    },
    {
      label: 'Visualizza',
      submenu: [
        { label: 'Ingrandisci', accelerator: 'CmdOrCtrl+Plus', click: () => sendAction('zoom-in') },
        { label: 'Riduci', accelerator: 'CmdOrCtrl+-', click: () => sendAction('zoom-out') },
        { label: 'Dimensione effettiva', accelerator: 'CmdOrCtrl+0', click: () => sendAction('zoom-reset') },
        { label: 'Adatta vista', accelerator: 'CmdOrCtrl+8', click: () => sendAction('fit') },
        { type: 'separator' },
        { label: 'Layout automatico', accelerator: 'CmdOrCtrl+L', click: () => sendAction('auto-layout') },
        { label: 'Valida architettura', accelerator: 'CmdOrCtrl+U', click: () => sendAction('show-validation') },
        { label: 'Versioni…', accelerator: 'CmdOrCtrl+4', click: () => sendAction('show-versions') },
        { type: 'separator' },
        { label: 'Mostra/Nascondi Explorer', accelerator: 'CmdOrCtrl+1', click: () => sendAction('toggle-explorer') },
        { label: 'Mostra/Nascondi Inspector', accelerator: 'CmdOrCtrl+2', click: () => sendAction('toggle-inspector') },
        { label: 'Mostra/Nascondi Chat AI', accelerator: 'CmdOrCtrl+J', click: () => sendAction('toggle-chat') },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Centro assistenza', accelerator: 'CmdOrCtrl+/', click: () => sendAction('help') },
        { label: 'Guida iniziale…', click: () => sendAction('onboarding') },
        { type: 'separator' as const },
        {
          label: 'Documentazione ArchiStudio',
          click: () => void shell.openPath(path.join(app.getAppPath(), 'README.md'))
        },
        { label: 'Apri cartella progetti', click: () => sendAction('open-projects') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function createWindow(): Promise<void> {
  const ws = loadWindowState()
  win = new BrowserWindow({
    width: ws.width,
    height: ws.height,
    ...(ws.x !== undefined && ws.y !== undefined ? { x: ws.x, y: ws.y } : {}),
    minWidth: 1100,
    minHeight: 700,
    title: 'ArchiStudio',
    show: true,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: 16 },
          vibrancy: 'sidebar' as const,
          visualEffectState: 'active' as const
        }
      : {}),
    backgroundColor: '#0b0e14',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  // ogni errore del renderer finisce nel crash log: diagnosticabile dopo, non solo live
  win.webContents.on('console-message', (...args: unknown[]) => {
    const ev = args[0] as { level?: string; message?: string } | number
    const level = typeof ev === 'object' ? ev?.level : args[1]
    const message = typeof ev === 'object' ? ev?.message : String(args[2] ?? '')
    if (level === 'error' || String(message).includes('Error:')) {
      appendLog(`renderer: ${String(message).slice(0, 1000)}`)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  trackWindowState(win)
  if (ws.maximized) win.maximize()
  win.on('closed', () => {
    win = null
  })
}

async function runSmoke(manager: ProjectManager): Promise<void> {
  const consoleLog: string[] = []
  // --smoke-project <nome>: screenshot di un progetto esistente invece del demo
  const projectArg = process.argv.find((a) => a.startsWith('--smoke-project='))
  let meta: import('../shared/types').ProjectMeta | undefined
  try {
    if (projectArg) {
      const want = projectArg.split('=')[1].toLowerCase()
      const list = await manager.listProjects()
      meta = list.find((p) => p.name.toLowerCase().startsWith(want) || p.name.toLowerCase().includes(want))
      if (!meta) throw new Error(`progetto non trovato: ${want}`)
    } else {
      meta = await seedDemoProject(manager)
    }
    await manager.openProject(meta!.id)
    win!.webContents.on('console-message', (...args: unknown[]) => {
      const ev = args[0] as { message?: string } | number
      const msg =
        typeof ev === 'object' && ev?.message
          ? ev.message
          : typeof args[2] === 'string'
            ? args[2]
            : String(args[1])
      consoleLog.push(String(msg).slice(0, 500))
    })
    win!.webContents.on('did-fail-load', (_e, code, desc) => {
      consoleLog.push(`did-fail-load ${code} ${desc}`)
    })
    await new Promise((r) => setTimeout(r, 3500))
    // screenshot del tour iniziale (riaperto forzatamente per verifica visiva)
    try {
      await win!.webContents.executeJavaScript('window.__archi.getState().reopenOnboarding()')
      await new Promise((r) => setTimeout(r, 500))
      const pngOb = await win!.webContents.capturePage()
      await fs.writeFile('/tmp/archistudio-smoke-onboarding.png', pngOb.toPNG())
      await win!.webContents.executeJavaScript('window.__archi.getState().completeOnboarding()')
      await new Promise((r) => setTimeout(r, 250))
    } catch (e) {
      consoleLog.push(`onboarding screenshot failed: ${String(e)}`)
    }
    // screenshot del centro assistenza
    try {
      await win!.webContents.executeJavaScript(`window.__archi.getState().openHelp('shortcuts')`)
      await new Promise((r) => setTimeout(r, 500))
      const pngHelp = await win!.webContents.capturePage()
      await fs.writeFile('/tmp/archistudio-smoke-help.png', pngHelp.toPNG())
      await win!.webContents.executeJavaScript('window.__archi.getState().closeHelp()')
      await new Promise((r) => setTimeout(r, 250))
    } catch (e) {
      consoleLog.push(`help screenshot failed: ${String(e)}`)
    }
    // screenshot delle Impostazioni (sezione MCP)
    try {
      await win!.webContents.executeJavaScript('window.__archi.getState().setSettingsOpen(true)')
      await new Promise((r) => setTimeout(r, 700))
      const pngSet = await win!.webContents.capturePage()
      await fs.writeFile('/tmp/archistudio-smoke-settings.png', pngSet.toPNG())
      await win!.webContents.executeJavaScript('window.__archi.getState().setSettingsOpen(false)')
      await new Promise((r) => setTimeout(r, 250))
    } catch (e) {
      consoleLog.push(`settings screenshot failed: ${String(e)}`)
    }
    // screenshot con le sidebar nascoste (verifica toggle)
    try {
      await win!.webContents.executeJavaScript(`(function () {
        const st = window.__archi.getState()
        if (st.showExplorer) st.toggleExplorer()
        if (st.showInspector) st.toggleInspector()
        return true
      })()`)
      await new Promise((r) => setTimeout(r, 500))
      const pngPan = await win!.webContents.capturePage()
      await fs.writeFile('/tmp/archistudio-smoke-panels.png', pngPan.toPNG())
      await win!.webContents.executeJavaScript(`(function () {
        const st = window.__archi.getState()
        if (!st.showExplorer) st.toggleExplorer()
        if (!st.showInspector) st.toggleInspector()
        return true
      })()`)
      await new Promise((r) => setTimeout(r, 300))
    } catch (e) {
      consoleLog.push(`panels screenshot failed: ${String(e)}`)
    }
    // il tour iniziale non deve comparire negli screenshot automatici
    try {
      await win!.webContents.executeJavaScript(`(function () {
        const st = window.__archi
        if (st?.getState().onboardingOpen) st.getState().completeOnboarding()
        return true
      })()`)
      await new Promise((r) => setTimeout(r, 300))
    } catch {
      /* niente onboarding da chiudere */
    }
    const png = await win!.webContents.capturePage()
    await fs.writeFile('/tmp/archistudio-smoke.png', png.toPNG())
    // secondo screenshot: vista dettaglio del componente "API"
    let detailOk = false
    try {
      await win!.webContents.executeJavaScript(`(function () {
        const st = window.__archi
        const node = st.getState().data.model.nodes.find((n) => n.name === 'API')
        if (!node) return false
        st.getState().openDetail(node.id)
        return true
      })()`)
      await new Promise((r) => setTimeout(r, 1200))
      const png2 = await win!.webContents.capturePage()
      await fs.writeFile('/tmp/archistudio-smoke-detail.png', png2.toPNG())
      detailOk = true
    } catch (e) {
      consoleLog.push(`detail screenshot failed: ${String(e)}`)
    }

    // sequenza interattiva: prova a riprodurre loop di render (#185) in scenari reali
    const steps: { name: string; ok: boolean; err?: string }[] = []
    let consoleMark = 0
    const runStep = async (name: string, js: string): Promise<void> => {
      const before = consoleMark
      consoleMark = consoleLog.length
      try {
        await win!.webContents.executeJavaScript(`(async () => { ${js} })()`)
        steps.push({ name, ok: true })
      } catch (e) {
        steps.push({ name, ok: false, err: String(e).slice(0, 300) })
      }
      const emitted = consoleLog.slice(before)
      const loopHere = emitted.some((l) => l.includes('185') || l.toLowerCase().includes('maximum update'))
      if (loopHere) steps[steps.length - 1].err = `REACT LOOP reproduced in this step`
      await new Promise((r) => setTimeout(r, 350))
    }
    await runStep('drag-move-node', `
      const st = window.__archi.getState()
      const n = st.data.model.nodes[0]
      await st.applyOps([{ op:'set_position', id:n.id, position:{ x:n.position.x+12, y:n.position.y+12 } }])
    `)
    await runStep('undo-drag', `await window.__archi.getState().undo()`)
    await runStep('select-api', "const st = window.__archi.getState(); const n0 = st.data.model.nodes.find(n=>n.name==='API') || st.data.model.nodes[0]; st.select([n0.id])")
    await runStep('save-from-detail', `
      const st = window.__archi.getState()
      const target = st.data.model.nodes.find(n=>n.name==='API') ?? st.data.model.nodes[0]
      await st.applyOps([{ op:'update_node', id: target.id, patch:{ description:'Aggiornato dal test ' + Date.now() } }])
    `)
    await runStep('open-detail-again', "(() => { const st = window.__archi.getState(); const t = st.data.model.nodes.find(n=>n.name==='API') ?? st.data.model.nodes[0]; st.openDetail(t.id); return true })()")
    await runStep('generate-system-spec', "await window.__archi.getState().generateArtifact('system')")
    await runStep('open-artifact-and-back', `
      const st = window.__archi.getState()
      const a = st.data.model.artifacts[0]
      if (a) { st.openArtifact(a.id); await new Promise(r=>setTimeout(r,300)); st.setView({kind:'canvas'}) }
    `)
    await runStep('auto-collapsed-on-open', `
      const st = window.__archi.getState()
      const parents = new Set(st.data.model.relations.filter((r) => r.type === 'component').map((r) => r.sourceId))
      const allCollapsed = [...parents].every((id) => st.collapsed[id])
      if (!allCollapsed) throw new Error('padri non collassati all apertura: ' + [...parents].filter((id) => !st.collapsed[id]).length)
      // flip a vista completa e ritorno
      st.setAllCollapsed(false)
      await new Promise((r) => setTimeout(r, 250))
      if (Object.keys(window.__archi.getState().collapsed).length !== 0) throw new Error('vista completa non applicata')
      window.__archi.getState().setAllCollapsed(true)
      await new Promise((r) => setTimeout(r, 250))
    `)
    await runStep('switch-project', `
      const st = window.__archi.getState()
      const other = st.projects.find((p) => p.id !== st.data.meta.id)
      if (other) {
        await st.switchProject(other.id)
        await new Promise((r) => setTimeout(r, 400))
      }
    `)
    await runStep('switch-back', `
      const st = window.__archi.getState()
      const other = st.projects.find((p) => p.id !== st.data.meta.id)
      if (other) await st.switchProject(other.id)
    `)
    await runStep('validation-and-versions', `
      const st = window.__archi.getState()
      st.setView({kind:'validation'}); await new Promise(r=>setTimeout(r,200))
      st.setView({kind:'versions'}); await new Promise(r=>setTimeout(r,200))
      st.setView({kind:'canvas'})
    `)
    await runStep('copy-paste', `
      const st = window.__archi.getState()
      st.copySelection()
      await st.pasteClipboard()
      await new Promise(r=>setTimeout(r,300))
    `)
    await runStep('undo-redo', `
      const st = window.__archi.getState()
      await st.undo(); await st.undo(); await st.redo(); await st.redo()
    `)
    await runStep('toggle-panels-and-chat', `
      const st = window.__archi.getState()
      st.toggleExplorer(); st.toggleExplorer()
      st.toggleInspector(); st.toggleInspector()
      st.setChatOpen(false); st.setChatOpen(true)
    `)
    await runStep('delete-pasted', `
      const st = window.__archi.getState()
      const copies = st.data.model.nodes.filter(n => n.name.includes('copia'))
      if (copies.length) await st.applyOps(copies.map(n => ({ op:'delete_node', id:n.id })))
    `)
    await runStep('multiselect-actions', `
      const st = window.__archi.getState()
      const ids = st.data.model.nodes.slice(0, 3).map((n) => n.id)
      st.select(ids)
      await new Promise((r) => setTimeout(r, 400))
      const fresh = window.__archi.getState()
      const bar = document.querySelector('.multisel-bar')
      if (!bar || fresh.selection.nodeIds.length !== 3) throw new Error('barra/selezione assente — diag: ' + JSON.stringify({ sel: fresh.selection.nodeIds.length, bar: Boolean(bar) }))
      st.select([])
      await new Promise((r) => setTimeout(r, 200))
    `)
    await runStep('search-dims-canvas', `
      const st = window.__archi.getState()
      st.setSearchQuery('redis')
      await new Promise((r) => setTimeout(r, 500))
      st.setSearchQuery('')
      await new Promise((r) => setTimeout(r, 300))
    `)
    await runStep('inline-rename', `
      const st = window.__archi.getState()
      const n = st.data.model.nodes[0]
      st.select([n.id])
      st.setEditingNodeId(n.id)
      await new Promise((r) => setTimeout(r, 400))
      const input = document.querySelector('.n-rename')
      if (!input) throw new Error('input rename assente')
      st.setEditingNodeId(null)
      st.select([])
      await new Promise((r) => setTimeout(r, 200))
    `)
    const loopDetected = consoleLog.some((l) => l.includes('185') || l.toLowerCase().includes('maximum update'))
    steps.push({ name: 'loop-detected', ok: !loopDetected })

    // screenshot: selezione con glow sui vicini
    try {
      await win!.webContents.executeJavaScript(`(async function () {
        const st = window.__archi.getState()
        st.setView({ kind: 'canvas' })
        const n = st.data.model.nodes.find((x) => x.id === st.selection.nodeIds[0]) ?? st.data.model.nodes[0]
        st.select([n.id])
        await new Promise((r) => setTimeout(r, 1200))
        return true
      })()`)
      const pngSel = await win!.webContents.capturePage()
      await fs.writeFile('/tmp/archistudio-smoke-selection.png', pngSel.toPNG())
    } catch (e) {
      consoleLog.push(`selection screenshot failed: ${String(e)}`)
    }

    // screenshot: AstraSocket V2 collassato (7 sotto-componenti nascosti, badge moduli)
    try {
      await win!.webContents.executeJavaScript(`(async function () {
        const st = window.__archi.getState()
        st.setView({ kind: 'canvas' })
        st.select([])
        const astra = st.data.model.nodes.find((x) => x.name === 'AstraSocket V2')
        if (astra) st.toggleCollapsed(astra.id)
        await new Promise((r) => setTimeout(r, 1000))
        return true
      })()`)
      const pngCol = await win!.webContents.capturePage()
      await fs.writeFile('/tmp/archistudio-smoke-collapsed.png', pngCol.toPNG())
      await win!.webContents.executeJavaScript(`(async function () {
        const st = window.__archi.getState()
        const astra = st.data.model.nodes.find((x) => x.name === 'AstraSocket V2')
        if (astra) st.toggleCollapsed(astra.id)
        return true
      })()`)
      await new Promise((r) => setTimeout(r, 400))
    } catch (e) {
      consoleLog.push(`collapsed screenshot failed: ${String(e)}`)
    }
    // screenshot: sotto-grafo espanso (hop 2)
    try {
      await win!.webContents.executeJavaScript(`(async function () {
        const st = window.__archi.getState()
        const target = st.data.model.nodes.find((x) => x.name === 'TycheFeed V1') ?? st.data.model.nodes.find((x) => x.type === 'api') ?? st.data.model.nodes[0]
        st.expandNode(target.id, 1)
        await new Promise((r) => setTimeout(r, 1400))
        return true
      })()`)
      const pngExp = await win!.webContents.capturePage()
      await fs.writeFile('/tmp/archistudio-smoke-expansion.png', pngExp.toPNG())
      await win!.webContents.executeJavaScript('window.__archi.getState().closeExpansion()')
      await win!.webContents.executeJavaScript('window.__archi.getState().select([])')
    } catch (e) {
      consoleLog.push(`expansion screenshot failed: ${String(e)}`)
    }
    let boundary: unknown = null
    try {
      boundary = await win!.webContents.executeJavaScript('window.__lastBoundary ?? null')
    } catch {
      boundary = null
    }
    await fs.writeFile(
      '/tmp/archistudio-smoke.json',
      JSON.stringify(
        {
          ok: true,
          project: meta!.name,
          nodes: manager.store.model.nodes.length,
          relations: manager.store.model.relations.length,
          artifacts: manager.store.model.artifacts.length,
          detailScreenshot: detailOk,
          steps,
          boundary,
          console: consoleLog.slice(0, 40)
        },
        null,
        2
      )
    )
    console.log('[smoke] screenshot: /tmp/archistudio-smoke.png')
  } catch (e) {
    console.error('[smoke] failed:', e)
    await fs.writeFile('/tmp/archistudio-smoke.json', JSON.stringify({ ok: false, error: String(e), console: consoleLog }))
  } finally {
    app.quit()
  }
}

app.whenReady().then(async () => {
  const settings = await loadSettings()
  const manager = new ProjectManager(settings)
  registerIpc(manager, () => win)
  buildMenu()
  if (isMac) {
    const iconPath = path.join(app.getAppPath(), 'build', 'icon.png')
    if (existsSync(iconPath)) {
      try {
        void app.dock?.setIcon(nativeImage.createFromPath(iconPath))
      } catch {
        /* dock icon optional */
      }
    }
  }
  await createWindow()
  if (isSmoke) await runSmoke(manager)
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

app.on('window-all-closed', () => {
  cleanupIpc()
  app.quit()
})

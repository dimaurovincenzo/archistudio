import { useEffect } from 'react'
import { api } from '../api'
import { useStore } from '../store'
import { ValidationView } from './ValidationView'
import { VersionsView } from './VersionsView'
import { ArtifactView } from './ArtifactView'
import { Canvas } from './Canvas'
import { ChatPanel } from './ChatPanel'
import { CommandPalette } from './CommandPalette'
import { HelpCenter } from './HelpCenter'
import { Onboarding } from './Onboarding'
import { ComponentDetailView } from './ComponentDetailView'
import { Explorer } from './Explorer'
import { Inspector } from './Inspector'
import { SettingsDialog } from './SettingsDialog'
import { Welcome } from './Welcome'
import { InputDialogHost } from './InputDialogHost'
import { ProjectSwitcher } from './ProjectSwitcher'
import { UndoIcon, RedoIcon, PanelLeftIcon, PanelRightIcon } from './toolbarIcons'

function StatusBar() {
  const data = useStore((s) => s.data)
  const issues = useStore((s) => s.issues)
  const mcp = useStore((s) => s.mcp)
  const lastSavedAt = useStore((s) => s.lastSavedAt)
  const setView = useStore((s) => s.setView)
  if (!data) return null
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  return (
    <div className="status-bar">
      <span>{data.meta.name}</span>
      <span className="clickable" onClick={() => setView({ kind: 'validation' })} style={{ color: errors ? 'var(--error)' : warnings ? 'var(--warn)' : 'var(--ok)' }}>
        {errors} errori, {warnings} avvisi
      </span>
      {lastSavedAt && (
        <span title="Tutte le modifiche vengono salvate automaticamente su disco">
          Salvato · {new Date(lastSavedAt).toLocaleTimeString()}
        </span>
      )}
      <span style={{ flex: 1 }} />
      <span className="clickable" title={`Modalità MCP: ${mcp?.mode ?? '?'} — configura nelle Impostazioni`} onClick={() => useStore.getState().setSettingsOpen(true)}>
        <span className={`status-dot ${mcp?.httpRunning ? 'on' : 'off'}`} />
        MCP · {mcp?.mode}
      </span>

    </div>
  )
}

function CenterArea() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const issueCount = useStore((s) => s.issues.length)
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const showExplorer = useStore((s) => s.showExplorer)
  const showInspector = useStore((s) => s.showInspector)
  const toggleExplorer = useStore((s) => s.toggleExplorer)
  const toggleInspector = useStore((s) => s.toggleInspector)
  return (
    <div className={`center${showExplorer ? '' : ' no-explorer'}`}>
      <div className="view-tabs">
        <div className="view-tabs-left">
          <ProjectSwitcher />
          <button className={`small ${view.kind === 'canvas' ? 'primary' : ''}`} onClick={() => setView({ kind: 'canvas' })}>Canvas</button>
          <button className={`small ${view.kind === 'validation' ? 'primary' : ''}`} onClick={() => setView({ kind: 'validation' })}>
            Validazione{issueCount ? ` (${issueCount})` : ''}
          </button>
          <button className={`small ${view.kind === 'versions' ? 'primary' : ''}`} onClick={() => setView({ kind: 'versions' })}>Versioni</button>
        </div>
        <div className="view-tabs-right">
          <button
            className={`small ghost panel-toggle${showExplorer ? ' active' : ''}`}
            title="Mostra/nascondi Explorer (⌘1)"
            onClick={toggleExplorer}
          >
            <PanelLeftIcon />
          </button>
          <button
            className={`small ghost panel-toggle${showInspector ? ' active' : ''}`}
            title="Mostra/nascondi Inspector (⌘2)"
            onClick={toggleInspector}
          >
            <PanelRightIcon />
          </button>
          <button className="small ghost" disabled={!canUndo} title="Annulla (⌘Z)" onClick={() => void undo()}><UndoIcon /></button>
          <button className="small ghost" disabled={!canRedo} title="Ripeti (⌘⇧Z)" onClick={() => void redo()}><RedoIcon /></button>
        </div>
      </div>
      {view.kind === 'canvas' && <Canvas />}
      {view.kind === 'validation' && <ValidationView />}
      {view.kind === 'versions' && <VersionsView />}
      {view.kind === 'artifact' && <ArtifactView id={view.id} />}
      {view.kind === 'detail' && <ComponentDetailView id={view.id} />}
    </div>
  )
}

export function App() {
  const boot = useStore((s) => s.boot)
  const data = useStore((s) => s.data)
  const toast = useStore((s) => s.toast)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const welcomeOverride = useStore((s) => s.welcomeOverride)
  const showExplorer = useStore((s) => s.showExplorer)
  const showInspector = useStore((s) => s.showInspector)

  useEffect(() => {
    void boot()
    const offChanged = api.events.onProjectChanged(() => {
      void (async () => {
        const fresh = await api.project.get().catch(() => null)
        if (fresh) {
          useStore.setState((s) => ({
            data: { meta: fresh.meta, model: fresh.model },
            modelVersion: s.modelVersion + 1
          }))
          void useStore.getState().runValidation()
        }
        await useStore.getState().refreshServerState()
      })()
    })
    const st = useStore.getState
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const editing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (editing) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod || !e.shiftKey) return
      const k = e.key.toLowerCase()
      if (k === 'c') {
        st().copySelection()
        e.preventDefault()
      } else if (k === 'x') {
        void st().cutSelection()
        e.preventDefault()
      } else if (k === 'v') {
        void st().pasteClipboard()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    const offMenu = api.events.onMenuAction((id) => {
      switch (id) {
        case 'settings':
          st().setSettingsOpen(true)
          break
        case 'new-project':
          st().setWelcomeOverride(true)
          break
        case 'open-project':
          st().setWelcomeOverride(true)
          break
        case 'open-projects':
          void api.app.revealProjects()
          break
        case 'save-version':
          void st().requestInput('Etichetta della versione:').then((label) => {
            if (label?.trim()) void st().createVersion(label.trim())
          })
          break
        case 'export-json':
          void st().exportFile('json')
          break
        case 'export-mermaid':
          void st().exportFile('mermaid')
          break
        case 'export-svg':
          void st().exportFile('svg')
          break
        case 'reveal-project':
          void api.app.revealProject()
          break
        case 'copy-nodes':
          st().copySelection()
          break
        case 'cut-nodes':
          void st().cutSelection()
          break
        case 'paste-nodes':
          void st().pasteClipboard()
          break
        case 'undo':
          void st().undo()
          break
        case 'redo':
          void st().redo()
          break
        case 'find':
          st().focusSearch()
          break
        case 'palette':
          st().setPaletteOpen(true)
          break
        case 'help':
          st().openHelp()
          break
        case 'onboarding':
          st().reopenOnboarding()
          break
        case 'zoom-in':
        case 'zoom-out':
        case 'zoom-reset':
        case 'fit':
        case 'auto-layout':
          st().runCanvasCmd(id as 'fit')
          break
        case 'show-validation':
          st().setView({ kind: 'validation' })
          break
        case 'show-versions':
          st().setView({ kind: 'versions' })
          break
        case 'toggle-explorer':
          st().toggleExplorer()
          break
        case 'toggle-inspector':
          st().toggleInspector()
          break
        case 'toggle-chat':
          st().setChatOpen(!st().chatOpen)
          break
      }
    })
    return () => {
      offChanged()
      offMenu()
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data || welcomeOverride) {
    return (
      <>
        <Welcome />
        <Onboarding />
        <HelpCenter />
        {settingsOpen && <SettingsDialog />}
        {toast && <div className="toast">{toast.text}</div>}
      </>
    )
  }

  return (
    <div className="app">
      <div className="main-row">
        {showExplorer && <Explorer />}
        <CenterArea />
        {showInspector && <Inspector />}
      </div>
      <ChatPanel />
      <StatusBar />
      <CommandPalette />
      <InputDialogHost />
      <Onboarding />
      <HelpCenter />
      {settingsOpen && <SettingsDialog />}
      {toast && (
        <div className="toast" key={toast.nonce}>
          <span>{toast.text}</span>
          {toast.action && (
            <button className="small primary toast-action" onClick={() => { toast.action!.run() }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

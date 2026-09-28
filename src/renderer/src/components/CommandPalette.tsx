import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { ARTIFACT_CATEGORIES, ArtifactCategory } from '../../../shared/types'

const ARTIFACT_LABELS: Record<ArtifactCategory, string> = {
  requirements: 'Requirements',
  system: 'System Specification',
  component: 'Component Specification',
  api: 'API Specification',
  database: 'Database Schema',
  dataflow: 'Data Flow',
  adr: 'ADR',
  deployment: 'Deployment'
}

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const setOpen = useStore((s) => s.setPaletteOpen)
  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const s = useStore

  const actions = useMemo(() => {
    const run = (fn: () => void) => () => {
      fn()
      setOpen(false)
    }
    const list: { id: string; label: string; section: string; run: () => void }[] = [
      { id: 'new', label: 'Nuovo progetto…', section: 'Progetto', run: run(() => s.getState().setWelcomeOverride(true)) },
      { id: 'save-version', label: 'Salva versione…', section: 'Progetto', run: run(() => {
        void s.getState().requestInput('Etichetta della versione:').then((label) => {
          if (label?.trim()) void s.getState().createVersion(label.trim())
        })
      }) },
      { id: 'open-folder', label: 'Apri cartella progetti', section: 'Progetto', run: run(() => void s.getState().refreshProjects()) },
      { id: 'switch-project', label: 'Cambia progetto…', section: 'Progetto', run: run(() => s.getState().setWelcomeOverride(true)) },
      { id: 'export-json', label: 'Esporta JSON…', section: 'Progetto', run: run(() => void s.getState().exportFile('json')) },
      { id: 'export-mermaid', label: 'Esporta Mermaid…', section: 'Progetto', run: run(() => void s.getState().exportFile('mermaid')) },
      { id: 'export-svg', label: 'Esporta SVG…', section: 'Progetto', run: run(() => void s.getState().exportFile('svg')) },
      { id: 'settings', label: 'Impostazioni…', section: 'Progetto', run: run(() => s.getState().setSettingsOpen(true)) },
      { id: 'undo', label: 'Annulla', section: 'Modifica', run: run(() => void s.getState().undo()) },
      { id: 'redo', label: 'Ripeti', section: 'Modifica', run: run(() => void s.getState().redo()) },
      { id: 'add-node', label: 'Aggiungi componente', section: 'Canvas', run: run(() => {
        void s.getState().applyOps([{ op: 'create_node', node: { name: 'Nuovo componente', type: 'generic', position: { x: 300, y: 220 } } }])
      }) },
      { id: 'add-group', label: 'Aggiungi gruppo', section: 'Canvas', run: run(() => {
        void s.getState().applyOps([{ op: 'create_group', group: { name: 'Nuovo gruppo' } }])
      }) },
      { id: 'layout', label: 'Layout automatico', section: 'Canvas', run: run(() => s.getState().runCanvasCmd('auto-layout')) },
      { id: 'fit', label: 'Adatta vista', section: 'Canvas', run: run(() => s.getState().runCanvasCmd('fit')) },
      { id: 'zoom-reset', label: 'Zoom predefinito', section: 'Canvas', run: run(() => s.getState().runCanvasCmd('zoom-reset')) },
      { id: 'validate', label: 'Valida architettura', section: 'Qualità', run: run(() => { void s.getState().runValidation(); s.getState().setView({ kind: 'validation' }) }) },
      { id: 'versions', label: 'Mostra versioni', section: 'Qualità', run: run(() => s.getState().setView({ kind: 'versions' })) },
      ...ARTIFACT_CATEGORIES.map((c) => ({
        id: `gen-${c}`,
        label: `Genera ${ARTIFACT_LABELS[c]}`,
        section: 'Artefatti',
        run: run(() => void s.getState().generateArtifact(c))
      })),
      { id: 'toggle-explorer', label: 'Mostra/Nascondi Explorer', section: 'Vista', run: run(() => s.getState().toggleExplorer()) },
      { id: 'toggle-inspector', label: 'Mostra/Nascondi Inspector', section: 'Vista', run: run(() => s.getState().toggleInspector()) },
      { id: 'toggle-chat', label: 'Mostra/Nascondi Chat AI', section: 'Vista', run: run(() => s.getState().setChatOpen(!s.getState().chatOpen)) },
      { id: 'find', label: 'Cerca nel progetto', section: 'Vista', run: run(() => s.getState().focusSearch()) }
    ]
    return list
  }, [s, setOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((a) => `${a.label} ${a.section}`.toLowerCase().includes(q))
  }, [actions, query])

  if (!open) return null

  return (
    <div className="modal-overlay palette-overlay" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Digita un comando…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIdx(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); filtered[idx]?.run() }
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="empty-hint">Nessun comando corrispondente</div>}
          {filtered.slice(0, 12).map((a, i) => (
            <div
              key={a.id}
              className={`palette-item${i === idx ? ' active' : ''}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => a.run()}
            >
              <span>{a.label}</span>
              <span className="palette-section">{a.section}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

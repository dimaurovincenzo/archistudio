import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { ChevronsDownIcon } from './toolbarIcons'

/** Selettore rapido del progetto corrente nella barra viste. */
export function ProjectSwitcher() {
  const projects = useStore((s) => s.projects)
  const data = useStore((s) => s.data)
  const switchProject = useStore((s) => s.switchProject)
  const refreshProjects = useStore((s) => s.refreshProjects)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) void refreshProjects()
  }, [open, refreshProjects])

  // elenco sempre fresco: rinfra anche quando la finestra torna in primo piano
  useEffect(() => {
    const onFocus = () => void refreshProjects()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshProjects])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  if (!data) return null
  const current = projects.find((p) => p.id === data.meta.id)

  return (
    <div className="proj-switcher" ref={ref}>
      <button className="small proj-switcher-btn" title="Cambia progetto" onClick={() => setOpen((o) => !o)}>
        <ChevronsDownIcon />
        <span className="proj-switcher-name">{current?.name ?? data.meta.name}</span>
      </button>
      {open && (
        <div className="proj-switcher-menu">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`proj-switcher-item${p.id === data.meta.id ? ' active' : ''}`}
              onClick={() => {
                setOpen(false)
                if (p.id !== data.meta.id) void switchProject(p.id)
              }}
            >
              <span className="proj-switcher-item-name">{p.name}</span>
              <span className="proj-switcher-item-date">{new Date(p.updatedAt).toLocaleDateString()}</span>
            </div>
          ))}
          {projects.length === 0 && <div className="empty-hint">Nessun altro progetto</div>}
          <div
            className="proj-switcher-item"
            onClick={() => {
              setOpen(false)
              useStore.getState().setWelcomeOverride(true)
            }}
          >
            <span className="proj-switcher-item-name">Tutti i progetti…</span>
          </div>
        </div>
      )}
    </div>
  )
}

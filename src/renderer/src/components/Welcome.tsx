import { useState } from 'react'
import { useStore } from '../store'
import { AppLogo } from '../icons'
import { api } from '../api'

export function Welcome() {
  const projects = useStore((s) => s.projects)
  const openProject = useStore((s) => s.openProject)
  const createProject = useStore((s) => s.createProject)
  const openDemo = useStore((s) => s.openDemo)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const setWelcomeOverride = useStore((s) => s.setWelcomeOverride)
  const overrideMode = useStore((s) => Boolean(s.data))
  const [name, setName] = useState('')

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-logo">
          <AppLogo />
          <div>
            <div className="welcome-title">ArchiStudio</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>AI Software Architecture Designer</div>
          </div>
        </div>
        <div className="welcome-tag">
          Progetta l'architettura del software prima del codice. Modello visuale, collaborazione con l'AI, accesso MCP per agenti esterni — l'architettura è la source of truth.
        </div>

        <div className="welcome-new">
          <input
            placeholder="Nome del nuovo progetto… es. «La mia piattaforma SaaS»"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && void createProject(name.trim(), '')}
          />
          <button className="primary" disabled={!name.trim()} onClick={() => void createProject(name.trim(), '')}>
            Crea progetto
          </button>
        </div>

        <div className="welcome-list">
          {projects.length === 0 && <div className="empty-hint">Nessun progetto — creane uno qui sopra o carica la demo.</div>}
          {projects.map((p) => (
            <div key={p.id} className="welcome-row" onClick={() => void openProject(p.id)}>
              <div style={{ flex: 1 }}>
                <div className="w-name">{p.name}</div>
                <div className="w-sub">aggiornato {new Date(p.updatedAt).toLocaleString()}</div>
              </div>
              <button
                className="small ghost"
                title="Elimina progetto"
                onClick={async (e) => {
                  e.stopPropagation()
                  if (window.confirm(`Eliminare il progetto «${p.name}» e tutti i suoi file?`)) {
                    await useStore.getState().deleteProject(p.id)
                  }
                }}
              >
                elimina
              </button>
            </div>
          ))}
        </div>

        <div className="welcome-actions">
          <button onClick={() => void openDemo()}>Carica progetto demo</button>
          <button onClick={() => void api.app.revealProjects()}>Apri cartella progetti</button>
          <button onClick={() => setSettingsOpen(true)}>Impostazioni</button>
          {overrideMode && <button className="primary" onClick={() => setWelcomeOverride(false)}>Torna al progetto</button>}
        </div>
      </div>
    </div>
  )
}

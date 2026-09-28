import { useState } from 'react'
import { useStore } from '../store'

export function VersionsView() {
  const versions = useStore((s) => s.versions)
  const createVersion = useStore((s) => s.createVersion)
  const restoreVersion = useStore((s) => s.restoreVersion)
  const [label, setLabel] = useState('')

  return (
    <div className="center-panel">
      <h2>Versions</h2>
      <div className="sub">
        Le versioni manuali vengono committate nella repository git del progetto. Prima di ogni modifica AI o MCP viene preso uno snapshot automatico, così puoi sempre tornare indietro.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, maxWidth: 460 }}>
        <input
          placeholder="Etichetta della versione, es. «Aggiunto layer di cache»"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && label.trim()) {
              void createVersion(label)
              setLabel('')
            }
          }}
        />
        <button
          className="primary"
          disabled={!label.trim()}
          onClick={() => {
            void createVersion(label)
            setLabel('')
          }}
        >
          Salva versione
        </button>
      </div>
      {versions.length === 0 && <div className="empty-hint">Nessuna versione. Creane una, oppure lascia che i flussi AI/MCP creino snapshot automatici.</div>}
      {versions.map((v) => (
        <div key={v.id} className="version-row">
          <div style={{ flex: 1 }}>
            <div className="v-label">{v.label}</div>
            <div className="v-meta">
              {new Date(v.createdAt).toLocaleString()} · {v.counts.nodes} componenti · {v.counts.relations} relazioni · {v.counts.artifacts} artefatti
            </div>
          </div>
          <span className={`badge ${v.auto ? 'auto' : ''}`}>{v.auto ? `auto (${v.source})` : 'manual'}</span>
          <button className="small" onClick={() => void restoreVersion(v.id)}>Ripristina</button>
        </div>
      ))}
    </div>
  )
}

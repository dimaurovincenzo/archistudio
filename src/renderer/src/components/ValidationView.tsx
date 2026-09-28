import { useState } from 'react'
import { useStore } from '../store'

export function ValidationView() {
  const issues = useStore((s) => s.issues)
  const runValidation = useStore((s) => s.runValidation)
  const focusNode = useStore((s) => s.focusNode)
  const openArtifact = useStore((s) => s.openArtifact)
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all')

  const shown = issues.filter((i) => filter === 'all' || i.severity === filter)
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length

  const onIssue = (nodeIds?: string[], artifactIds?: string[]) => {
    if (nodeIds && nodeIds.length > 0) focusNode(nodeIds[0])
    else if (artifactIds && artifactIds.length > 0) openArtifact(artifactIds[0])
  }

  return (
    <div className="center-panel">
      <h2>Validazione architetturale</h2>
      <div className="sub">
        Controlli strutturali sul modello: riferimenti pendenti, dipendenze circolari, componenti orfani, responsabilità mancanti, artefatti scollegati.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`small ${filter === 'all' ? 'primary' : ''}`} onClick={() => setFilter('all')}>Tutti ({issues.length})</button>
        <button className={`small ${filter === 'error' ? 'primary' : ''}`} onClick={() => setFilter('error')}>Errori ({errors})</button>
        <button className={`small ${filter === 'warning' ? 'primary' : ''}`} onClick={() => setFilter('warning')}>Avvisi ({warnings})</button>
        <span style={{ flex: 1 }} />
        <button className="small" onClick={() => void runValidation()}>Riesegui</button>
      </div>
      {shown.length === 0 && (
        <div className="empty-hint">Nessun problema trovato. L'architettura supera i controlli strutturali.</div>
      )}
      {shown.map((i) => (
        <div key={i.id} className="issue" onClick={() => onIssue(i.nodeIds, i.artifactIds)}>
          <span className={`sev ${i.severity}`} />
          <div>
            <div>{i.message}</div>
            <div className="i-code">{i.severity} · {i.code}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

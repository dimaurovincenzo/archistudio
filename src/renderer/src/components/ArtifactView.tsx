import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import { useStore } from '../store'
import { ARTIFACT_CATEGORIES } from '../../../shared/types'

marked.setOptions({ breaks: true, async: false })

export function ArtifactView({ id }: { id: string }) {
  const data = useStore((s) => s.data)
  const applyOps = useStore((s) => s.applyOps)
  const generateArtifact = useStore((s) => s.generateArtifact)
  const showToast = useStore((s) => s.showToast)
  const setView = useStore((s) => s.setView)
  const [draft, setDraft] = useState<{ title: string; content: string; category: string; nodeIds: string[] } | null>(null)
  const [mode, setMode] = useState<'edit' | 'split' | 'preview'>('edit')

  const artifact = data?.model.artifacts.find((a) => a.id === id)
  const model = data?.model

  useEffect(() => {
    if (artifact)
      setDraft({
        title: artifact.title,
        content: artifact.content,
        category: artifact.category,
        nodeIds: [...artifact.nodeIds]
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, artifact?.updatedAt])

  const dirty = useMemo(
    () =>
      artifact &&
      draft &&
      (draft.title !== artifact.title ||
        draft.content !== artifact.content ||
        draft.category !== artifact.category ||
        draft.nodeIds.join() !== artifact.nodeIds.join()),
    [artifact, draft]
  )

  if (!artifact || !draft || !model) {
    return (
      <div className="center-panel">
        <div className="empty-hint">Artefatto non trovato.</div>
      </div>
    )
  }

  const save = async () => {
    const ok = await applyOps([
      {
        op: 'update_artifact',
        id: artifact.id,
        patch: { title: draft.title, content: draft.content, category: draft.category as never, nodeIds: draft.nodeIds }
      }
    ])
    if (ok) showToast('Artefatto salvato')
  }

  const html = marked.parse(draft.content.replace(/<script[\s\S]*?<\/script>/gi, '')) as string

  return (
    <div className="center-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="artifact-head">
        <input
          className="title-input"
          style={{ flex: 1 }}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <select
          style={{ width: 'auto' }}
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        >
          {ARTIFACT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="small" onClick={() => setMode(mode === 'edit' ? 'split' : mode === 'split' ? 'preview' : 'edit')}>{mode === 'edit' ? 'Split' : mode === 'split' ? 'Anteprima' : 'Modifica'}</button>
        <button className="small primary" disabled={!dirty} onClick={() => void save()}>
          Salva
        </button>
        <button
          className="small"
          title="Rigenera questo documento dal modello architetturale (template)"
          onClick={() => void generateArtifact(artifact.category, artifact.nodeIds[0], artifact.title)}
        >
          Rigenera
        </button>
        <button
          className="small danger"
          onClick={() => {
            void applyOps([{ op: 'delete_artifact', id: artifact.id }])
            setView({ kind: 'canvas' })
          }}
        >
          Elimina
        </button>
      </div>
      <div className="artifact-meta">
        <span>
          {artifact.derived === 'template'
            ? 'Generato dal modello (template)'
            : artifact.derived === 'ai'
              ? 'Generato dall\'AI — verifica sempre prima di fidarti'
              : artifact.derived === 'mcp'
                ? 'Creato via MCP'
                : 'Manuale'}
        </span>
        <span>aggiornato {new Date(artifact.updatedAt).toLocaleString()}</span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          collegato a:
          {model.nodes
            .filter((n) => draft.nodeIds.includes(n.id))
            .map((n) => (
              <span key={n.id} className="chip clickable" title="Unlink" onClick={() => setDraft({ ...draft, nodeIds: draft.nodeIds.filter((x) => x !== n.id) })}>
                {n.name} ×
              </span>
            ))}
          <select
            style={{ width: 'auto', fontSize: 11 }}
            value=""
            onChange={(e) => {
              if (e.target.value && !draft.nodeIds.includes(e.target.value))
                setDraft({ ...draft, nodeIds: [...draft.nodeIds, e.target.value] })
              e.target.value = ''
            }}
          >
            <option value="">+ collega componente…</option>
            {model.nodes
              .filter((n) => !draft.nodeIds.includes(n.id))
              .map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </span>
      </div>
      <div className={`artifact-editor${mode !== 'edit' ? ' with-preview' : ''}${mode === 'split' ? ' split' : ''}`}>
        {mode !== 'preview' && (
          <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} spellCheck={false} />
        )}
        {mode !== 'edit' && <div className="artifact-preview" dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { TECH_CATALOG, TECH_BY_TYPE, TechEntry } from '../../../shared/tech'
import { NODE_CATEGORIES } from '../../../shared/types'
import { nodeIcon } from '../icons'

const CATEGORY_LABELS: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend & linguaggi',
  data: 'Database & dati',
  infrastructure: 'Infrastruttura',
  external: 'Servizi esterni',
  ai: 'AI',
  generic: 'Generici'
}

export function TechPicker({
  value,
  onSelect,
  onClose
}: {
  value: string
  onSelect: (type: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const all: TechEntry[] = TECH_CATALOG
    if (!q) return all
    return all.filter((e) => `${e.type} ${e.label} ${e.keywords ?? ''}`.toLowerCase().includes(q))
  }, [q])

  const grouped = useMemo(() => {
    const map = new Map<string, TechEntry[]>()
    for (const e of matches) {
      map.set(e.category, [...(map.get(e.category) ?? []), e])
    }
    return map
  }, [matches])

  const flat = useMemo(() => matches, [matches])

  useEffect(() => {
    setIdx(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector('.tech-item.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const current = TECH_BY_TYPE.get(value)
  const exactMatch = flat[idx]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tech-picker" onClick={(e) => e.stopPropagation()}>
        <h3>Tecnologia del componente</h3>
        <div className="modal-sub">
          Attuale: {current ? `${current.label}` : `«${value}» (custom)`}. Cerca e scegli; il tipo determina icona, colore e categoria nel grafico.
        </div>
        <input
          autoFocus
          placeholder="Cerca tecnologia… (es. postgres, kafka, react, openai)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, flat.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter') {
              e.preventDefault()
              const pick = exactMatch ?? (q ? { type: q } : null)
              if (pick) {
                onSelect(pick.type)
                onClose()
              }
            }
          }}
        />
        <div className="tech-list" ref={listRef}>
          {NODE_CATEGORIES.filter((c) => grouped.has(c)).map((cat) => (
            <div key={cat}>
              <div className="section-title" style={{ margin: '10px 0 4px' }}>{CATEGORY_LABELS[cat]}</div>
              <div className="tech-grid">
                {grouped.get(cat)!.map((e) => {
                  const i = flat.indexOf(e)
                  const active = i === idx
                  const selected = e.type === value
                  return (
                    <button
                      key={e.type}
                      className={`tech-item${active ? ' active' : ''}${selected ? ' selected' : ''}`}
                      style={{ '--tech': e.color } as CSSProperties}
                      onMouseEnter={() => setIdx(i)}
                      onClick={() => {
                        onSelect(e.type)
                        onClose()
                      }}
                      title={e.keywords ?? e.label}
                    >
                      <span className="tech-icon" style={{ color: e.color }}>{nodeIcon(e.type)}</span>
                      <span className="tech-label">{e.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="empty-hint">
              Nessuna tecnologia trovata. premi Invio per usare «{q}» come tipo custom.
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Annulla</button>
          <button
            className="primary"
            disabled={!q}
            title={q ? `Usa «${q}» come tipo custom` : ''}
            onClick={() => {
              if (q) {
                onSelect(q)
                onClose()
              }
            }}
          >
            Usa tipo custom{q ? `: ${q}` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

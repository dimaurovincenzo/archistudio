import { ArchiModel } from '../shared/types'

function esc(s: string): string {
  return s.replace(/"/g, "'").replace(/[{}<>]/g, '')
}

function mid(model: ArchiModel): string {
  const map = new Map<string, string>()
  model.nodes.forEach((n, i) => map.set(n.id, `n${i}`))
  const lines = model.nodes.map((n) => {
    const shape =
      n.category === 'data'
        ? `[( "${esc(n.name)}" )]`
        : n.category === 'external'
          ? `>"${esc(n.name)}"]`
          : `["${esc(n.name)}"]`
    return `  ${map.get(n.id)}${shape}`
  })
  const rels = model.relations.map((r) => {
    const a = map.get(r.sourceId)
    const b = map.get(r.targetId)
    if (!a || !b) return null
    const label = r.type + (r.protocol ? ` / ${r.protocol}` : '')
    const arrow = r.direction === 'two-way' ? '<-->' : '-->'
    return `  ${a} ${arrow} |${esc(label)}| ${b}`
  })
  return ['flowchart LR', ...lines, ...rels.filter((x): x is string => Boolean(x))].join('\n')
}

export function exportJson(model: ArchiModel, meta: { name: string; description: string }): string {
  return JSON.stringify({ format: 'archistudio', version: 1, meta, model }, null, 2)
}

export function exportMermaid(model: ArchiModel): string {
  return mid(model)
}

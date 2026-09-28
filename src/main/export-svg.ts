import { ArchiModel } from '../shared/types'
import dagre from '@dagrejs/dagre'
import { techInfo } from '../shared/tech'

const W = 190
const H = 84

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur.trim())
      cur = w
    } else cur += ' ' + w
  }
  if (cur.trim()) lines.push(cur.trim())
  return lines.slice(0, 3)
}

/** Esporta il modello come SVG standalone (layout LR, stili ArchiStudio, font di sistema). */
export function exportSvg(model: ArchiModel, projectName: string): string {
  // layout con dagre (stesso motore della canvas)
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 130, marginx: 40, marginy: 40 })
  for (const n of model.nodes) g.setNode(n.id, { width: W, height: H })
  for (const r of model.relations) {
    if (model.nodes.some((n) => n.id === r.sourceId) && model.nodes.some((n) => n.id === r.targetId)) {
      g.setEdge(r.sourceId, r.targetId)
    }
  }
  dagre.layout(g)

  const pos = new Map<string, { x: number; y: number }>()
  for (const n of model.nodes) {
    const p = g.node(n.id)
    pos.set(n.id, { x: p.x - W / 2, y: p.y - H / 2 })
  }

  // dimensioni grafo
  let maxX = 800
  let maxY = 600
  for (const p of pos.values()) {
    maxX = Math.max(maxX, p.x + W + 40)
    maxY = Math.max(maxY, p.y + H + 40)
  }

  // gruppi: bounding box
  const groupBoxes = model.groups
    .map((g2) => {
      const members = model.nodes.filter((n) => n.groupId === g2.id)
      if (members.length === 0) return null
      let minX = Infinity; let minY = Infinity; let mx = -Infinity; let my = -Infinity
      for (const m of members) {
        const p = pos.get(m.id)!
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
        mx = Math.max(mx, p.x + W); my = Math.max(my, p.y + H)
      }
      return { g: g2, x: minX - 22, y: minY - 30, w: mx - minX + 44, h: my - minY + 48 }
    })
    .filter(Boolean) as { g: (typeof model.groups)[number]; x: number; y: number; w: number; h: number }[]

  const byId = new Map(model.nodes.map((n) => [n.id, n]))
  const out: string[] = []

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(maxX)}" height="${Math.ceil(maxY)}" viewBox="0 0 ${Math.ceil(maxX)} ${Math.ceil(maxY)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">`)
  out.push(`<rect width="100%" height="100%" fill="#0b0e14"/>`)

  // titolo
  out.push(`<text x="24" y="34" font-size="18" font-weight="700" fill="#e6e9f0">${esc(projectName)}</text>`)
  out.push(`<text x="24" y="54" font-size="11" fill="#8b93a7">${esc(`${model.nodes.length} componenti · ${model.relations.length} relazioni — generato da ArchiStudio`)}</text>`)

  // defs: frecce
  out.push(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#7d8699"/></marker></defs>`)

  // gruppi
  for (const gb of groupBoxes) {
    out.push(`<rect x="${gb.x}" y="${gb.y}" width="${Math.ceil(gb.w)}" height="${Math.ceil(gb.h)}" rx="16" fill="${gb.g.color}0d" stroke="${gb.g.color}66" stroke-dasharray="5 4"/>`)
    out.push(`<text x="${gb.x + 12}" y="${gb.y + 18}" font-size="11" font-weight="700" letter-spacing="1" fill="${gb.g.color}">${esc(gb.g.name.toUpperCase())}</text>`)
  }

  // relazioni
  for (const r of model.relations) {
    const s = pos.get(r.sourceId)
    const t = pos.get(r.targetId)
    if (!s || !t) continue
    const x1 = s.x + W
    const y1 = s.y + H / 2
    const x2 = t.x
    const y2 = t.y + H / 2
    const mx = (x1 + x2) / 2
    const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
    out.push(`<path d="${path}" fill="none" stroke="#7d8699" stroke-width="1.6" marker-end="url(#arrow)"${r.direction === 'two-way' ? ' marker-start="url(#arrow)"' : ''}/>`)
    const label = r.type.toUpperCase() + (r.protocol ? ` · ${r.protocol}` : '')
    out.push(`<text x="${mx}" y="${(y1 + y2) / 2 - 6}" font-size="9.5" fill="#aab2c5" text-anchor="middle">${esc(label)}</text>`)
  }

  // nodi
  for (const n of model.nodes) {
    const p = pos.get(n.id)!
    const tech = techInfo(n.type)
    const color = tech.known ? tech.color : '#94a3b8'
    out.push(`<rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="11" fill="#171c27" stroke="#2e374b"/>`)
    // tile icona (quadratino colorato) + punto categoria
    out.push(`<rect x="${p.x + 10}" y="${p.y + 10}" width="26" height="26" rx="7" fill="${color}33"/>`)
    out.push(`<circle cx="${p.x + 23}" cy="${p.y + 23}" r="5" fill="${color}"/>`)
    // nome (max 2 righe)
    const nameLines = wrap(n.name, 22)
    nameLines.forEach((line, i) => {
      out.push(`<text x="${p.x + 44}" y="${p.y + 22 + i * 14}" font-size="12" font-weight="600" fill="#e6e9f0">${esc(line)}</text>`)
    })
    // tipo tecnologia sotto
    out.push(`<text x="${p.x + 44}" y="${p.y + 22 + nameLines.length * 14 + 2}" font-size="9" fill="#8b93a7" letter-spacing="0.5">${esc(tech.label.toUpperCase())}</text>`)
    // meta operativa: host:port · dominio
    const meta = [n.properties?.host, n.properties?.port].filter(Boolean).join(':')
    const metaParts = [meta, n.properties?.instances ? `${n.properties.instances}×` : '', n.properties?.domain].filter(Boolean)
    if (metaParts.length > 0) {
      out.push(`<text x="${p.x + 44}" y="${p.y + 22 + nameLines.length * 14 + 14}" font-size="8.5" fill="#22d3ee" font-family="Menlo, monospace">${esc(metaParts.join(' · '))}</text>`)
    }
    // tecnologia sotto il nodo
    if (n.technology) {
      out.push(`<text x="${p.x + 10}" y="${p.y + H - 8}" font-size="9" fill="#5c6478" font-family="Menlo, monospace">${esc(n.technology.slice(0, 30))}</text>`)
    }
  }

  out.push('</svg>')
  return out.join('\n')
}

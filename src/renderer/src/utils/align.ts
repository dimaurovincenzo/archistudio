import { ArchiNode, Op } from '../../../shared/types'

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter' | 'dist-h' | 'dist-v'

const W = 190
const H = 84

export interface AlignableNode {
  id: string
  position: { x: number; y: number }
}

/**
 * Ops di allineamento/distribuzione per una selezione di nodi.
 * Puro e testabile: restituisce solo set_position per i nodi che cambiano davvero.
 */
export function buildAlignOps(
  nodes: AlignableNode[],
  mode: AlignMode
): { ops: Op[]; changed: number } {
  if (nodes.length < 2) return { ops: [], changed: 0 }

  const minX = Math.min(...nodes.map((n) => n.position.x))
  const maxX = Math.max(...nodes.map((n) => n.position.x + W))
  const minY = Math.min(...nodes.map((n) => n.position.y))
  const maxY = Math.max(...nodes.map((n) => n.position.y + H))

  let ops: { id: string; x: number; y: number }[] = []

  switch (mode) {
    case 'left':
      ops = nodes.map((n) => ({ id: n.id, x: minX, y: n.position.y }))
      break
    case 'right':
      ops = nodes.map((n) => ({ id: n.id, x: maxX - W, y: n.position.y }))
      break
    case 'top':
      ops = nodes.map((n) => ({ id: n.id, x: n.position.x, y: minY }))
      break
    case 'bottom':
      ops = nodes.map((n) => ({ id: n.id, x: n.position.x, y: maxY - H }))
      break
    case 'hcenter': {
      const cx = (minX + maxX) / 2
      ops = nodes.map((n) => ({ id: n.id, x: cx - W / 2, y: n.position.y }))
      break
    }
    case 'vcenter': {
      const cy = (minY + maxY) / 2
      ops = nodes.map((n) => ({ id: n.id, x: n.position.x, y: cy - H / 2 }))
      break
    }
    case 'dist-h': {
      const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x)
      const span = maxX - minX - W
      const stepN = sorted.length - 1
      const step = stepN > 0 ? span / stepN : 0
      ops = sorted.map((n, i) => ({ id: n.id, x: minX + i * step, y: n.position.y }))
      break
    }
    case 'dist-v': {
      const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y)
      const span = maxY - minY - H
      const stepN = sorted.length - 1
      const step = stepN > 0 ? span / stepN : 0
      ops = sorted.map((n, i) => ({ id: n.id, x: n.position.x, y: minY + i * step }))
      break
    }
  }

  const result: Op[] = []
  for (const o of ops) {
    const n = nodes.find((x) => x.id === o.id)!
    if (Math.round(n.position.x) !== Math.round(o.x) || Math.round(n.position.y) !== Math.round(o.y)) {
      result.push({ op: 'set_position', id: o.id, position: { x: o.x, y: o.y } })
    }
  }
  return { ops: result, changed: result.length }
}

/** Raggruppa i nodi selezionati in un gruppo nuovo con il nome dato. */
export function buildGroupOps(nodes: ArchiNode[], groupName: string): Op[] {
  const groupId = `g_${Math.random().toString(36).slice(2, 10)}`
  const ops: Op[] = [{ op: 'create_group', group: { id: groupId, name: groupName } as never }]
  for (const n of nodes) {
    ops.push({ op: 'update_node', id: n.id, patch: { groupId } })
  }
  return ops
}

export { buildPasteOps, extractClipboard } from './paste'
export type { ClipboardContent } from './paste'

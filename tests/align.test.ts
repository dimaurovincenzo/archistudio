import { describe, expect, it } from 'vitest'
import { buildAlignOps, buildGroupOps, AlignableNode } from '../src/renderer/src/utils/align'
import { applyOps } from '../src/main/ops'
import { ArchiModel } from '../src/shared/types'

const N = (id: string, x: number, y: number): AlignableNode => ({ id, position: { x, y } })

describe('allineamento e distribuzione', () => {
  it('align left porta tutti alla x minima', () => {
    const nodes = [N('a', 100, 0), N('b', 300, 50), N('c', 500, 90)]
    const { ops, changed } = buildAlignOps(nodes, 'left')
    expect(changed).toBe(2)
    const xs = ops.map((o) => (o as { position: { x: number } }).position.x)
    expect(xs.every((x) => x === 100)).toBe(true)
  })

  it('align vcenter centra sulla mediana verticale del bounding box', () => {
    const nodes = [N('a', 0, 0), N('b', 100, 400)]
    const { ops } = buildAlignOps(nodes, 'vcenter')
    // bounding: minY 0, maxY 400+84=484 → cy 242 → y = 242-42 = 200 per tutti
    expect(ops.every((o) => (o as { position: { y: number } }).position.y === 200)).toBe(true)
  })

  it('dist-h distribuisce uniformemente mantenendo l’ordine', () => {
    const m: ArchiModel = { nodes: [], relations: [], groups: [], artifacts: [] }
    applyOps(m, [
      { op: 'create_node', node: { id: 'a', name: 'A', position: { x: 0, y: 0 } } },
      { op: 'create_node', node: { id: 'b', name: 'B', position: { x: 700, y: 10 } } },
      { op: 'create_node', node: { id: 'c', name: 'C', position: { x: 810, y: 20 } } }
    ])
    const nodes = m.nodes.map((n) => ({ id: n.id, position: { ...n.position } }))
    const { ops } = buildAlignOps(nodes, 'dist-h')
    expect(applyOps(m, ops).ok).toBe(true)
    const px = new Map(m.nodes.map((n) => [n.id, n.position.x]))
    expect(px.get('a')).toBe(0)
    expect(px.get('b')).toBe(405)
    expect(px.get('c')).toBe(810)
  })

  it('con un solo nodo non fa nulla', () => {
    expect(buildAlignOps([N('a', 5, 5)], 'left')).toEqual({ ops: [], changed: 0 })
  })

  it('non genera ops quando è già allineato', () => {
    const nodes = [N('a', 100, 0), N('b', 100, 50)]
    expect(buildAlignOps(nodes, 'left')).toEqual({ ops: [], changed: 0 })
  })

  it('le ops generate si applicano al modello', () => {
    const m: ArchiModel = { nodes: [], relations: [], groups: [], artifacts: [] }
    applyOps(m, [
      { op: 'create_node', node: { id: 'a', name: 'A', position: { x: 0, y: 0 } } },
      { op: 'create_node', node: { id: 'b', name: 'B', position: { x: 400, y: 300 } } }
    ])
    const { ops } = buildAlignOps([N('a', 0, 0), N('b', 400, 300)], 'top')
    expect(applyOps(m, ops).ok).toBe(true)
    expect(m.nodes[1].position.y).toBe(0)
  })

  it('buildGroupOps crea gruppo e assegna i nodi', () => {
    const m: ArchiModel = { nodes: [], relations: [], groups: [], artifacts: [] }
    applyOps(m, [
      { op: 'create_node', node: { id: 'a', name: 'A' } },
      { op: 'create_node', node: { id: 'b', name: 'B' } }
    ])
    const ops = buildGroupOps(
      m.nodes.filter((n) => ['a', 'b'].includes(n.id)),
      'Servizi'
    )
    expect(applyOps(m, ops).ok).toBe(true)
    expect(m.groups).toHaveLength(1)
    expect(m.groups[0].name).toBe('Servizi')
    expect(m.nodes.every((n) => n.groupId === m.groups[0].id)).toBe(true)
  })
})

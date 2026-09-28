import { describe, expect, it } from 'vitest'
import { applyOps } from '../src/main/ops'
import { ArchiModel, Op } from '../src/shared/types'

function model(): ArchiModel {
  return { nodes: [], relations: [], groups: [], artifacts: [] }
}

function seed(): { m: ArchiModel; api: string; db: string } {
  const m = model()
  applyOps(m, [
    { op: 'create_node', node: { name: 'API', type: 'api' } },
    { op: 'create_node', node: { name: 'PostgreSQL', type: 'database' } }
  ])
  return { m, api: m.nodes[0].id, db: m.nodes[1].id }
}

describe('applyOps', () => {
  it('creates nodes with defaults and unique ids', () => {
    const m = model()
    const res = applyOps(m, [
      { op: 'create_node', node: { name: 'A', type: 'api' } },
      { op: 'create_node', node: { name: 'B' } }
    ])
    expect(res.ok).toBe(true)
    expect(m.nodes).toHaveLength(2)
    expect(m.nodes[0].id).not.toBe(m.nodes[1].id)
    expect(m.nodes[1].category).toBe('generic')
    expect(m.nodes[0].category).toBe('backend')
  })

  it('rejects create_node without name', () => {
    const res = applyOps(model(), [{ op: 'create_node', node: { name: '  ' } }])
    expect(res.ok).toBe(false)
    expect(res.error).toContain('name is required')
  })

  it('creates relations by id and by unique name (batch-aware)', () => {
    const m = model()
    const res = applyOps(m, [
      { op: 'create_node', node: { name: 'API', type: 'api' } },
      { op: 'create_node', node: { name: 'Redis' } },
      { op: 'create_relation', relation: { sourceId: 'Redis', targetId: 'API', type: 'cache' } as never }
    ])
    expect(res.ok).toBe(true)
    expect(m.relations).toHaveLength(1)
    expect(m.relations[0].sourceId).toBe(m.nodes[1].id)
    expect(m.relations[0].targetId).toBe(m.nodes[0].id)
  })

  it('fails when a relation references a missing node', () => {
    const { m, api } = seed()
    const res = applyOps(m, [{ op: 'create_relation', relation: { sourceId: api, targetId: 'n_missing' } }])
    expect(res.ok).toBe(false)
    expect(m.relations).toHaveLength(0)
  })

  it('is atomic: a failing op leaves the model unchanged', () => {
    const { m } = seed()
    const before = JSON.stringify(m)
    applyOps(m, [
      { op: 'create_node', node: { name: 'X' } },
      { op: 'create_relation', relation: { sourceId: 'n_nope', targetId: 'n_nope2' } }
    ])
    expect(JSON.stringify(m)).toBe(before)
  })

  it('delete_node cascades to relations and artifact links', () => {
    const { m, api, db } = seed()
    applyOps(m, [
      { op: 'create_relation', relation: { sourceId: api, targetId: db, type: 'db' } },
      { op: 'create_artifact', artifact: { title: 'Spec', category: 'component', nodeIds: [api, db] } }
    ])
    const res = applyOps(m, [{ op: 'delete_node', id: api }])
    expect(res.ok).toBe(true)
    expect(m.relations).toHaveLength(0)
    expect(m.artifacts[0].nodeIds).toEqual([db])
  })

  it('update_node patches only provided fields', () => {
    const { m, api } = seed()
    applyOps(m, [{ op: 'update_node', id: api, patch: { technology: 'Node.js', responsibilities: ['route', 'validate'] } }])
    const node = m.nodes.find((n) => n.id === api)!
    expect(node.technology).toBe('Node.js')
    expect(node.responsibilities).toEqual(['route', 'validate'])
    expect(node.name).toBe('API')
  })

  it('groups: create, assign, delete keeps nodes', () => {
    const { m, api } = seed()
    applyOps(m, [{ op: 'create_group', group: { name: 'Backend' } }])
    const gid = m.groups[0].id
    applyOps(m, [{ op: 'update_node', id: api, patch: { groupId: gid } }])
    expect(m.nodes[0].groupId).toBe(gid)
    applyOps(m, [{ op: 'delete_group', id: gid }])
    expect(m.groups).toHaveLength(0)
    expect(m.nodes[0].groupId).toBeNull()
  })

  it('validates artifact category and requires title', () => {
    const m = model()
    expect(applyOps(m, [{ op: 'create_artifact', artifact: { title: 'X', category: 'nope' as never } }]).ok).toBe(false)
    expect(applyOps(m, [{ op: 'create_artifact', artifact: { title: '', category: 'api' } }]).ok).toBe(false)
    expect(applyOps(m, [{ op: 'create_artifact', artifact: { title: 'Ok', category: 'api' } }]).ok).toBe(true)
  })

  it('set_position updates coordinates', () => {
    const { m, api } = seed()
    applyOps(m, [{ op: 'set_position', id: api, position: { x: 42, y: -7 } }])
    expect(m.nodes[0].position).toEqual({ x: 42, y: -7 })
  })

  it('reports unknown ops', () => {
    const res = applyOps(model(), [{ op: 'launch_missile' } as unknown as Op])
    expect(res.ok).toBe(false)
    expect(res.error).toContain('unknown op')
  })
})

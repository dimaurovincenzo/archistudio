import { describe, expect, it } from 'vitest'
import { applyOps } from '../src/main/ops'
import { validateModel } from '../src/main/validation'
import { ArchiModel } from '../src/shared/types'

function build(ops: Parameters<typeof applyOps>[1]): ArchiModel {
  const m: ArchiModel = { nodes: [], relations: [], groups: [], artifacts: [] }
  const res = applyOps(m, ops)
  expect(res.ok).toBe(true)
  return m
}

describe('validateModel', () => {
  it('flags dangling relations as errors', () => {
    const m: ArchiModel = {
      nodes: [],
      relations: [{ id: 'r1', sourceId: 'a', targetId: 'b', type: 'db', direction: 'one-way', description: '', protocol: '', payload: '', metadata: {}, createdAt: '', updatedAt: '' }],
      groups: [],
      artifacts: []
    }
    const issues = validateModel(m)
    expect(issues.some((i) => i.code === 'dangling_relation' && i.severity === 'error')).toBe(true)
  })

  it('detects circular dependencies', () => {
    const m = build([
      { op: 'create_node', node: { name: 'A' } },
      { op: 'create_node', node: { name: 'B' } },
      { op: 'create_node', node: { name: 'C' } },
      { op: 'create_relation', relation: { sourceId: 'A', targetId: 'B' } },
      { op: 'create_relation', relation: { sourceId: 'B', targetId: 'C' } },
      { op: 'create_relation', relation: { sourceId: 'C', targetId: 'A' } }
    ])
    const issues = validateModel(m)
    expect(issues.some((i) => i.code === 'circular_dependency')).toBe(true)
  })

  it('flags orphan nodes and missing responsibilities', () => {
    const m = build([{ op: 'create_node', node: { name: 'Lone' } }])
    const codes = validateModel(m).map((i) => i.code)
    expect(codes).toContain('orphan_node')
    expect(codes).toContain('no_responsibility')
  })

  it('flags duplicate names', () => {
    const m = build([
      { op: 'create_node', node: { name: 'Service', description: 'x' } },
      { op: 'create_node', node: { name: 'service', description: 'y' } }
    ])
    expect(validateModel(m).some((i) => i.code === 'duplicate_name')).toBe(true)
  })

  it('flags unlinked artifacts and dangling artifact references', () => {
    // dangling references can only appear through external file edits —
    // applyOps keeps referential integrity — so build the model by hand
    const m: ArchiModel = {
      nodes: [{ id: 'n1', name: 'A', type: 'api', category: 'backend', description: 'x', responsibilities: [], technology: '', tags: [], properties: {}, groupId: null, position: { x: 0, y: 0 }, createdAt: '', updatedAt: '' }],
      relations: [],
      groups: [],
      artifacts: [
        { id: 'a1', title: 'Orphan doc', category: 'system', content: '', nodeIds: [], derived: 'manual', createdAt: '', updatedAt: '' },
        { id: 'a2', title: 'Bad link', category: 'component', content: '', nodeIds: ['n_ghost'], derived: 'manual', createdAt: '', updatedAt: '' }
      ]
    }
    const issues = validateModel(m)
    expect(issues.some((i) => i.code === 'artifact_unlinked')).toBe(true)
    expect(issues.some((i) => i.code === 'artifact_dangling_reference' && i.severity === 'error')).toBe(true)
  })

  it('clean model produces no issues', () => {
    const m = build([
      { op: 'create_node', node: { name: 'API', type: 'api', description: 'The API', responsibilities: ['serve'] } },
      { op: 'create_node', node: { name: 'DB', type: 'database', description: 'The DB', responsibilities: ['store'] } },
      { op: 'create_relation', relation: { sourceId: 'API', targetId: 'DB', type: 'db' } },
      { op: 'create_artifact', artifact: { title: 'API Spec', category: 'api', nodeIds: ['API'] } }
    ])
    const issues = validateModel(m)
    expect(issues).toEqual([])
  })
})

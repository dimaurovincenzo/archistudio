import { describe, expect, it } from 'vitest'
import { applyOps } from '../src/main/ops'
import { buildPasteOps, extractClipboard } from '../src/renderer/src/utils/paste'
import { ArchiModel } from '../src/shared/types'

function seeded(): { m: ArchiModel; api: string; db: string; cache: string } {
  const m: ArchiModel = { nodes: [], relations: [], groups: [], artifacts: [] }
  applyOps(m, [
    { op: 'create_node', node: { id: 'n_api', name: 'API', type: 'api', description: 'd' } },
    { op: 'create_node', node: { id: 'n_db', name: 'DB', type: 'postgresql', description: 'd' } },
    { op: 'create_node', node: { id: 'n_cache', name: 'Redis', type: 'redis', description: 'd' } },
    { op: 'create_relation', relation: { sourceId: 'n_api', targetId: 'n_db', type: 'db' } },
    { op: 'create_relation', relation: { sourceId: 'n_api', targetId: 'n_cache', type: 'cache' } }
  ])
  return { m, api: 'n_api', db: 'n_db', cache: 'n_cache' }
}

let counter = 0
const fakeId = (prefix: string) => `${prefix}_fake${++counter}`

describe('copy/paste componenti', () => {
  it('extractClipboard prende nodi selezionati e solo relazioni interne', () => {
    const { m, api, db } = seeded()
    const clip = extractClipboard(m, [api, db])
    expect(clip).not.toBeNull()
    expect(clip!.nodes.map((n) => n.name).sort()).toEqual(['API', 'DB'])
    expect(clip!.relations).toHaveLength(1) // la relazione verso Redis resta fuori
  })

  it('buildPasteOps clona nodi con nuovi id e ricollega le relazioni interne', () => {
    const { m, api, db } = seeded()
    const clip = extractClipboard(m, [api, db])!
    const { ops, idByOld, pastedIds } = buildPasteOps(clip, { x: 40, y: 40 }, fakeId)
    expect(pastedIds).toHaveLength(2)
    expect(idByOld.get(api)).toBe('n_fake1')
    expect(idByOld.get(db)).toBe('n_fake2')

    const res = applyOps(m, ops)
    expect(res.ok).toBe(true)

    // i nodi incollati esistono con posizione scalata e relazione interna collegata
    const pastedApi = m.nodes.find((n) => n.id === 'n_fake1')!
    const pastedDb = m.nodes.find((n) => n.id === 'n_fake2')!
    expect(pastedApi.name).toBe('API')
    expect(pastedApi.position.x).toBe(m.nodes.find((n) => n.id === api)!.position.x + 40)
    expect(pastedDb.type).toBe('postgresql')
    expect(m.relations.some((r) => r.sourceId === 'n_fake1' && r.targetId === 'n_fake2' && r.type === 'db')).toBe(true)
  })

  it('le relazioni verso nodi NON copiati non vengono clonate', () => {
    const { m, api } = seeded()
    const clip = extractClipboard(m, [api])!
    expect(clip.relations).toHaveLength(0)
    const { ops } = buildPasteOps(clip, { x: 0, y: 0 }, fakeId)
    const before = m.relations.length
    expect(applyOps(m, ops).ok).toBe(true)
    expect(m.relations.length).toBe(before + 0)
  })

  it('l\'id esplicito di create_node è rispettato se libero', () => {
    const m: ArchiModel = { nodes: [], relations: [], groups: [], artifacts: [] }
    const res = applyOps(m, [{ op: 'create_node', node: { id: 'n_custom', name: 'X' } }])
    expect(res.ok).toBe(true)
    expect(m.nodes[0].id).toBe('n_custom')
  })
})

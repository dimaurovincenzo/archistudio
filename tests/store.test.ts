import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ProjectStore } from '../src/main/store'
import { applyOps } from '../src/main/ops'
import { createSnapshot, listSnapshots, readSnapshot } from '../src/main/versioning'
import { generateArtifactContent } from '../src/main/templates'
import { buildAiContext } from '../src/main/context'

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'archi-test-'))
}

describe('ProjectStore roundtrip', () => {
  it('persists nodes, relations, groups and artifacts to readable files', async () => {
    const root = tmp()
    const s1 = await ProjectStore.create(root, 'Roundtrip Project', 'desc')
    applyOps(s1.model, [
      { op: 'create_node', node: { name: 'API', type: 'api', description: 'the api' } },
      { op: 'create_node', node: { name: 'DB', type: 'database', description: 'the db' } },
      { op: 'create_relation', relation: { sourceId: 'API', targetId: 'DB', type: 'db', payload: 'users table' } },
      { op: 'create_artifact', artifact: { title: 'API Spec', category: 'api', content: '# Hello\n\nWorld', nodeIds: ['API'] } }
    ])
    await s1.persist()

    // on-disk layout (PRD §24)
    expect(fs.existsSync(path.join(s1.dir, 'project.json'))).toBe(true)
    expect(fs.readdirSync(path.join(s1.dir, 'architecture', 'nodes'))).toHaveLength(2)
    expect(fs.readdirSync(path.join(s1.dir, 'architecture', 'relations'))).toHaveLength(1)
    expect(fs.readdirSync(path.join(s1.dir, 'artifacts'))[0]).toMatch(/\.md$/)

    // artifact is markdown with frontmatter, readable without the app
    const mdFile = fs.readdirSync(path.join(s1.dir, 'artifacts'))[0]
    const md = fs.readFileSync(path.join(s1.dir, 'artifacts', mdFile), 'utf8')
    expect(md.startsWith('---\n')).toBe(true)
    expect(md).toContain('# Hello')

    // reopen: identical model
    const s2 = await ProjectStore.open(s1.dir)
    expect(s2.model.nodes.map((n) => n.name).sort()).toEqual(['API', 'DB'])
    expect(s2.model.relations[0].payload).toBe('users table')
    expect(s2.model.artifacts[0].content).toBe('# Hello\n\nWorld')
    const apiId = s1.model.nodes.find((n) => n.name === 'API')!.id
    expect(s2.model.artifacts[0].nodeIds).toEqual([apiId])

    fs.rmSync(root, { recursive: true, force: true })
  })

  it('deletes remove files from disk', async () => {
    const root = tmp()
    const s = await ProjectStore.create(root, 'Deletion Project')
    applyOps(s.model, [{ op: 'create_node', node: { name: 'Temp' } }])
    await s.persist()
    const id = s.model.nodes[0].id
    applyOps(s.model, [{ op: 'delete_node', id }])
    await s.persist()
    const s2 = await ProjectStore.open(s.dir)
    expect(s2.model.nodes).toHaveLength(0)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('versioning', () => {
  it('snapshots, lists and restores', async () => {
    const root = tmp()
    const s = await ProjectStore.create(root, 'Versions Project')
    applyOps(s.model, [{ op: 'create_node', node: { name: 'A', description: 'x' } }])
    const snap = await createSnapshot(s, s.model, 'v0.1 initial', 'manual')
    expect(snap.counts.nodes).toBe(1)

    applyOps(s.model, [{ op: 'create_node', node: { name: 'B', description: 'y' } }])
    await createSnapshot(s, s.model, 'v0.2 added B', 'ai')

    const list = await listSnapshots(s)
    expect(list).toHaveLength(2)
    expect(list[0].label).toBe('v0.2 added B')
    expect(list[0].source).toBe('ai')

    const restore = await readSnapshot(s, snap.id)
    expect(restore!.model.nodes).toHaveLength(1)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('templates + context', () => {
  it('generates a component spec with model-derived tables', async () => {
    const root = tmp()
    const s = await ProjectStore.create(root, 'Tpl')
    applyOps(s.model, [
      { op: 'create_node', node: { name: 'API', type: 'api', description: 'd', technology: 'Node' } },
      { op: 'create_node', node: { name: 'DB', type: 'database', description: 'd' } },
      { op: 'create_relation', relation: { sourceId: 'API', targetId: 'DB', type: 'db', protocol: 'SQL' } }
    ])
    const gen = generateArtifactContent(s.model, 'component', { nodeId: s.model.nodes[0].id })
    expect(gen.title).toContain('API')
    expect(gen.content).toContain('## Interfacce (in ingresso)')
    expect(gen.content).toContain('DB')
    expect(gen.content).toContain('## Strategia di errore')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('dataflow finds paths between components', async () => {
    const root = tmp()
    const s = await ProjectStore.create(root, 'Flow')
    applyOps(s.model, [
      { op: 'create_node', node: { name: 'Web', description: 'd' } },
      { op: 'create_node', node: { name: 'API', description: 'd' } },
      { op: 'create_node', node: { name: 'DB', description: 'd' } },
      { op: 'create_relation', relation: { sourceId: 'Web', targetId: 'API', type: 'rest' } },
      { op: 'create_relation', relation: { sourceId: 'API', targetId: 'DB', type: 'db' } }
    ])
    const gen = generateArtifactContent(s.model, 'dataflow', {})
    expect(gen.content).toContain('Web → API → DB')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('ai context includes selection, neighbors and relations', async () => {
    const root = tmp()
    const s = await ProjectStore.create(root, 'Ctx')
    applyOps(s.model, [
      { op: 'create_node', node: { name: 'API', type: 'api', description: 'd' } },
      { op: 'create_node', node: { name: 'DB', type: 'database', description: 'd' } },
      { op: 'create_node', node: { name: 'Far', description: 'd' } },
      { op: 'create_relation', relation: { sourceId: 'API', targetId: 'DB', type: 'db' } }
    ])
    const api = s.model.nodes.find((n) => n.name === 'API')!
    const ctx = JSON.parse(buildAiContext(s.model, { nodeIds: [api.id], wholeProject: false }))
    expect(ctx.selection.nodes[0].name).toBe('API')
    expect(ctx.selection.connectedComponents[0].name).toBe('DB')
    expect(ctx.selection.relations[0].type).toBe('db')
    expect(JSON.stringify(ctx.selection.connectedComponents)).not.toContain('Far')
    fs.rmSync(root, { recursive: true, force: true })
  })
})

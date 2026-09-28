import fs from 'node:fs/promises'
import path from 'node:path'
import {
  ArchiArtifact,
  ArchiGroup,
  ArchiModel,
  ArchiNode,
  ArchiRelation,
  ArtifactCategory,
  ProjectData,
  ProjectMeta
} from '../shared/types'
import { newId, nowIso, slugify } from '../shared/ids'

const DIRS = {
  nodes: 'architecture/nodes',
  relations: 'architecture/relations',
  groups: 'architecture/groups',
  artifacts: 'artifacts',
  versions: 'versions',
  internal: '.archi'
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true })
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(file))
  const tmp = `${file}.tmp-${process.pid}`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

// ---- Artifact markdown (frontmatter + body) --------------------------------

function encodeArtifact(a: ArchiArtifact): string {
  const fm = [
    '---',
    `id: ${a.id}`,
    `title: ${JSON.stringify(a.title)}`,
    `category: ${a.category}`,
    `derived: ${a.derived}`,
    `nodeIds: [${a.nodeIds.map((n) => JSON.stringify(n)).join(', ')}]`,
    `createdAt: ${a.createdAt}`,
    `updatedAt: ${a.updatedAt}`,
    '---',
    ''
  ]
  return fm.join('\n') + a.content
}

function decodeArtifact(raw: string, file: string): ArchiArtifact | null {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw)
  if (!m) return null
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  if (!meta.id || !meta.category) return null
  const parseList = (s: string | undefined): string[] => {
    if (!s) return []
    try {
      const v = JSON.parse(s)
      if (Array.isArray(v)) return v.map(String)
    } catch {
      /* not JSON */
    }
    return s
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((x) => x.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  return {
    id: meta.id,
    title: JSON.parse(meta.title || '""') || path.basename(file, '.md'),
    category: meta.category as ArtifactCategory,
    derived: (meta.derived as ArchiArtifact['derived']) || 'manual',
    nodeIds: parseList(meta.nodeIds),
    content: m[2] ?? '',
    createdAt: meta.createdAt || nowIso(),
    updatedAt: meta.updatedAt || meta.createdAt || nowIso()
  }
}

// ----------------------------------------------------------------------------

export interface PersistTouched {
  nodes?: Set<string>
  relations?: Set<string>
  groups?: Set<string>
  artifacts?: Set<string>
}

export class ProjectStore {
  readonly dir: string
  meta!: ProjectMeta
  model: ArchiModel = { nodes: [], relations: [], groups: [], artifacts: [] }
  private artFileCache = new Map<string, string>()

  private constructor(dir: string) {
    this.dir = dir
  }

  static async open(dir: string): Promise<ProjectStore> {
    const store = new ProjectStore(dir)
    await store.reload()
    return store
  }

  static async create(
    projectsRoot: string,
    name: string,
    description = ''
  ): Promise<ProjectStore> {
    const id = `${slugify(name)}-${newId('p').slice(2)}`
    const dir = path.join(projectsRoot, id)
    await ensureDir(dir)
    for (const rel of [...Object.values(DIRS)]) await ensureDir(path.join(dir, rel))
    const meta: ProjectMeta = {
      id,
      name,
      description,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
    await writeJsonAtomic(path.join(dir, 'project.json'), meta)
    return ProjectStore.open(dir)
  }

  async reload(): Promise<ProjectData> {
    const meta = await readJson<ProjectMeta>(path.join(this.dir, 'project.json'))
    if (!meta) throw new Error(`Not a valid ArchiStudio project: ${this.dir}`)
    this.meta = { ...meta, path: this.dir }
    const model: ArchiModel = {
      nodes: await this.loadEntities<ArchiNode>(DIRS.nodes),
      relations: await this.loadEntities<ArchiRelation>(DIRS.relations),
      groups: await this.loadEntities<ArchiGroup>(DIRS.groups),
      artifacts: await this.loadArtifacts()
    }
    this.model = model
    this.artFileCache.clear()
    return { meta: this.meta, model }
  }

  private async loadEntities<T extends { id: string }>(rel: string): Promise<T[]> {
    const abs = path.join(this.dir, rel)
    let files: string[] = []
    try {
      files = (await fs.readdir(abs)).filter((f) => f.endsWith('.json'))
    } catch {
      return []
    }
    const out: T[] = []
    for (const f of files.sort()) {
      const v = await readJson<T>(path.join(abs, f))
      if (v && typeof v.id === 'string') out.push(v)
    }
    return out
  }

  private async loadArtifacts(): Promise<ArchiArtifact[]> {
    const abs = path.join(this.dir, DIRS.artifacts)
    let files: string[] = []
    try {
      files = (await fs.readdir(abs)).filter((f) => f.endsWith('.md'))
    } catch {
      return []
    }
    const out: ArchiArtifact[] = []
    for (const f of files) {
      try {
        const a = decodeArtifact(await fs.readFile(path.join(abs, f), 'utf8'), f)
        if (a) out.push(a)
      } catch {
        /* skip malformed */
      }
    }
    return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  private entityPath(kind: 'nodes' | 'relations' | 'groups', id: string): string {
    return path.join(this.dir, DIRS[kind], `${id}.json`)
  }

  private async findArtifactFile(a: ArchiArtifact): Promise<string> {
    const cached = this.artFileCache.get(a.id)
    if (cached) return cached
    const abs = path.join(this.dir, DIRS.artifacts)
    const candidate = path.join(abs, `${slugify(a.title)}--${a.id}.md`)
    try {
      await fs.access(candidate)
      this.artFileCache.set(a.id, candidate)
      return candidate
    } catch {
      // fallback: scansiona i .md cercando l'id nel frontmatter
      const files = await fs.readdir(abs).catch(() => [])
      for (const f of files.filter((x) => x.endsWith('.md'))) {
        const raw = await fs.readFile(path.join(abs, f), 'utf8').catch(() => '')
        if (raw.includes(`id: ${a.id}\n`)) {
          this.artFileCache.set(a.id, path.join(abs, f))
          return path.join(abs, f)
        }
      }
      return candidate // file nuovo
    }
  }

  /** Persist the in-memory model to disk; with `touched` writes only the changed entities. */
  async persist(touched?: PersistTouched): Promise<void> {
    const pick = <T extends { id: string }>(set: Set<string> | undefined, arr: T[]): T[] =>
      set ? arr.filter((x) => set.has(x.id)) : arr
    const keep = {
      nodes: new Set(this.model.nodes.map((n) => n.id)),
      relations: new Set(this.model.relations.map((r) => r.id)),
      groups: new Set(this.model.groups.map((g) => g.id)),
      artifacts: new Set(this.model.artifacts.map((a) => a.id))
    }
    for (const n of pick(touched?.nodes, this.model.nodes))
      await writeJsonAtomic(this.entityPath('nodes', n.id), n)
    for (const r of pick(touched?.relations, this.model.relations))
      await writeJsonAtomic(this.entityPath('relations', r.id), r)
    for (const g of pick(touched?.groups, this.model.groups))
      await writeJsonAtomic(this.entityPath('groups', g.id), g)
    for (const a of pick(touched?.artifacts, this.model.artifacts)) {
      const file = await this.findArtifactFile(a)
      const tmp = `${file}.tmp-${process.pid}`
      await fs.writeFile(tmp, encodeArtifact(a), 'utf8')
      await fs.rename(tmp, file)
      this.artFileCache.set(a.id, file)
    }
    // remove orphaned files (deleted entities)
    for (const [kind, rel] of [
      ['nodes', DIRS.nodes],
      ['relations', DIRS.relations],
      ['groups', DIRS.groups]
    ] as const) {
      const abs = path.join(this.dir, rel)
      const files = await fs.readdir(abs).catch(() => [])
      for (const f of files) {
        if (f.endsWith('.json') && !keep[kind].has(f.replace(/\.json$/, ''))) {
          await fs.unlink(path.join(abs, f)).catch(() => {})
        }
      }
    }
    const absArt = path.join(this.dir, DIRS.artifacts)
    const artFiles = await fs.readdir(absArt).catch(() => [])
    for (const f of artFiles) {
      if (!f.endsWith('.md')) continue
      const raw = await fs.readFile(path.join(absArt, f), 'utf8').catch(() => '')
      const dec = decodeArtifact(raw, f)
      if (!dec || !keep.artifacts.has(dec.id)) {
        await fs.unlink(path.join(absArt, f)).catch(() => {})
      }
    }
    await this.touchMeta()
  }

  async touchMeta(patch: Partial<ProjectMeta> = {}): Promise<void> {
    this.meta = { ...this.meta, ...patch, updatedAt: nowIso() }
    const { path: _p, ...meta } = this.meta
    await writeJsonAtomic(path.join(this.dir, 'project.json'), meta)
  }

  // ---- versions -------------------------------------------------------------

  versionFile(id: string): string {
    return path.join(this.dir, DIRS.versions, `${id}.json`)
  }

  // ---- internal data (proposals, audit) --------------------------------------

  proposalFile(id: string): string {
    return path.join(this.dir, DIRS.internal, 'proposals', `${id}.json`)
  }

  auditFile(): string {
    return path.join(this.dir, DIRS.internal, 'audit.jsonl')
  }

  async appendAudit(entry: Record<string, unknown>): Promise<void> {
    const line = JSON.stringify({ ts: nowIso(), ...entry }) + '\n'
    await ensureDir(path.dirname(this.auditFile()))
    await fs.appendFile(this.auditFile(), line, 'utf8')
  }
}

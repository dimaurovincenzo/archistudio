import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ArchiModel, VersionSnapshot, VersionSnapshotMeta } from '../shared/types'
import { ProjectStore } from './store'
import { newId, nowIso } from '../shared/ids'

const execFileAsync = promisify(execFile)

function counts(model: ArchiModel) {
  return {
    nodes: model.nodes.length,
    relations: model.relations.length,
    groups: model.groups.length,
    artifacts: model.artifacts.length
  }
}

export async function createSnapshot(
  store: ProjectStore,
  model: ArchiModel,
  label: string,
  source: 'manual' | 'ai' | 'mcp'
): Promise<VersionSnapshot> {
  const snapshot: VersionSnapshot = {
    id: newId('v'),
    label: label.trim() || 'Untitled version',
    auto: source !== 'manual',
    source,
    createdAt: nowIso(),
    counts: counts(model),
    model: structuredClone(model)
  }
  const file = store.versionFile(snapshot.id)
  const tmp = `${file}.tmp-${process.pid}`
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(snapshot), 'utf8')
  await fs.rename(tmp, file)
  if (source === 'manual') await gitCommit(store.dir, `version: ${snapshot.label}`)
  return snapshot
}

export async function listSnapshots(store: ProjectStore): Promise<VersionSnapshotMeta[]> {
  const dir = path.join(store.dir, 'versions')
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'))
  const out: VersionSnapshotMeta[] = []
  for (const f of files) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) as VersionSnapshot
      out.push({
        id: raw.id,
        label: raw.label,
        auto: raw.auto,
        source: raw.source,
        createdAt: raw.createdAt,
        counts: raw.counts
      })
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function readSnapshot(
  store: ProjectStore,
  id: string
): Promise<VersionSnapshot | null> {
  try {
    return JSON.parse(await fs.readFile(store.versionFile(id), 'utf8')) as VersionSnapshot
  } catch {
    return null
  }
}

/** Best-effort git commit; initializes a repo on first use. Never throws. */
export async function gitCommit(dir: string, message: string): Promise<{ ok: boolean; detail: string }> {
  try {
    await fs.access(path.join(dir, '.git'))
  } catch {
    try {
      await execFileAsync('git', ['init', '-q'], { cwd: dir })
      await fs.writeFile(
        path.join(dir, '.gitignore'),
        '.archi/\n*.tmp-*\n',
        'utf8'
      ).catch(() => {})
    } catch {
      return { ok: false, detail: 'git not available' }
    }
  }
  try {
    await execFileAsync('git', ['add', '-A'], { cwd: dir })
    const { stderr } = await execFileAsync('git', ['commit', '-m', message, '--allow-empty'], {
      cwd: dir,
      env: { ...process.env, GIT_AUTHOR_NAME: 'ArchiStudio', GIT_AUTHOR_EMAIL: 'archistudio@local', GIT_COMMITTER_NAME: 'ArchiStudio', GIT_COMMITTER_EMAIL: 'archistudio@local' }
    })
    return { ok: true, detail: stderr?.trim() || 'committed' }
  } catch (e) {
    return { ok: false, detail: String((e as Error).message ?? e) }
  }
}

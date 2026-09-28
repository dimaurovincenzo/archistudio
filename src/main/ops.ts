import {
  ArchiModel,
  ARTIFACT_CATEGORIES,
  NODE_CATEGORIES,
  Op,
  ArtifactCategory,
  NodeCategory
} from '../shared/types'
import { newId, nowIso } from '../shared/ids'
import { suggestCategory } from '../shared/tech'

export interface ApplyResult {
  ok: boolean
  error?: string
  applied: number
  touched: {
    nodes: Set<string>
    relations: Set<string>
    groups: Set<string>
    artifacts: Set<string>
  }
}

function emptyTouched(): ApplyResult['touched'] {
  return {
    nodes: new Set(),
    relations: new Set(),
    groups: new Set(),
    artifacts: new Set()
  }
}

function asCategory(v: unknown): NodeCategory {
  return NODE_CATEGORIES.includes(v as NodeCategory) ? (v as NodeCategory) : 'generic'
}

function asArtifactCategory(v: unknown): ArtifactCategory | null {
  return ARTIFACT_CATEGORIES.includes(v as ArtifactCategory)
    ? (v as ArtifactCategory)
    : null
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function strRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      out[k] = String(val)
    }
  }
  return out
}

/**
 * Apply a batch of operations to the model. All-or-nothing: if any op fails,
 * the original model is returned unchanged with ok=false.
 * This is the single mutation path used by the UI, the AI layer and MCP.
 */
export function applyOps(
  model: ArchiModel,
  ops: Op[],
  opts: { idFactory?: (prefix: string) => string } = {}
): ApplyResult {
  const idOf = opts.idFactory ?? newId
  const m: ArchiModel = structuredClone(model)
  const touched = emptyTouched()
  const ts = nowIso()

  const nodeIdx = (id: string) => m.nodes.findIndex((n) => n.id === id)
  const relIdx = (id: string) => m.relations.findIndex((r) => r.id === id)
  const grpIdx = (id: string) => m.groups.findIndex((g) => g.id === id)
  const artIdx = (id: string) => m.artifacts.findIndex((a) => a.id === id)

  // Resolves a relation endpoint that may be an id or a unique component name.
  // Evaluated at apply time, so refs to nodes created earlier in the same batch work.
  const resolveNodeRef = (ref: string): string | null => {
    if (m.nodes.some((n) => n.id === ref)) return ref
    const hits = m.nodes.filter((n) => n.name.toLowerCase() === ref.trim().toLowerCase())
    return hits.length === 1 ? hits[0].id : null
  }

  const fail = (error: string): ApplyResult => ({ ok: false, error, applied: 0, touched })

  for (const raw of ops) {
    switch (raw.op) {
      case 'create_node': {
        const name = str(raw.node?.name).trim()
        if (!name) return fail('create_node: name is required')
        // id esplicito (usato da copy/paste) se libero, altrimenti generato
        let nodeId = idOf('n')
        if (typeof raw.node?.id === 'string' && raw.node.id && nodeIdx(raw.node.id) < 0) {
          nodeId = raw.node.id
        }
        const node = {
          id: nodeId,
          name,
          type: str(raw.node?.type, 'generic'),
          category: asCategory(raw.node?.category ?? guessCategory(str(raw.node?.type))),
          description: str(raw.node?.description),
          responsibilities: strArray(raw.node?.responsibilities),
          technology: str(raw.node?.technology),
          tags: strArray(raw.node?.tags),
          properties: strRecord(raw.node?.properties),
          groupId:
            raw.node?.groupId && grpIdx(String(raw.node.groupId)) >= 0
              ? String(raw.node.groupId)
              : null,
          position: {
            x: Number(raw.node?.position?.x) || 0,
            y: Number(raw.node?.position?.y) || 0
          },
          createdAt: ts,
          updatedAt: ts
        }
        m.nodes.push(node)
        touched.nodes.add(node.id)
        break
      }
      case 'update_node': {
        const i = nodeIdx(raw.id)
        if (i < 0) return fail(`update_node: node not found: ${raw.id}`)
        const p = raw.patch ?? {}
        const n = m.nodes[i]
        if (p.name !== undefined) n.name = str(p.name, n.name).trim() || n.name
        if (p.type !== undefined) n.type = str(p.type, n.type)
        if (p.category !== undefined) n.category = asCategory(p.category)
        if (p.description !== undefined) n.description = str(p.description)
        if (p.responsibilities !== undefined) n.responsibilities = strArray(p.responsibilities)
        if (p.technology !== undefined) n.technology = str(p.technology)
        if (p.tags !== undefined) n.tags = strArray(p.tags)
        if (p.properties !== undefined) n.properties = strRecord(p.properties)
        if (p.groupId !== undefined)
          n.groupId = p.groupId && grpIdx(String(p.groupId)) >= 0 ? String(p.groupId) : null
        n.updatedAt = ts
        touched.nodes.add(n.id)
        break
      }
      case 'delete_node': {
        const i = nodeIdx(raw.id)
        if (i < 0) return fail(`delete_node: node not found: ${raw.id}`)
        m.nodes.splice(i, 1)
        m.relations = m.relations.filter((r) => r.sourceId !== raw.id && r.targetId !== raw.id)
        for (const a of m.artifacts) a.nodeIds = a.nodeIds.filter((x) => x !== raw.id)
        touched.nodes.add(raw.id)
        break
      }
      case 'create_relation': {
        const sourceId = resolveNodeRef(String(raw.relation?.sourceId ?? ''))
        const targetId = resolveNodeRef(String(raw.relation?.targetId ?? ''))
        if (!sourceId) return fail(`create_relation: source not found: ${raw.relation?.sourceId}`)
        if (!targetId) return fail(`create_relation: target not found: ${raw.relation?.targetId}`)
        if (sourceId === targetId) return fail('create_relation: self-loops are not allowed')
        const rel = {
          id: idOf('r'),
          sourceId,
          targetId,
          type: str(raw.relation?.type, 'dependency'),
          direction: raw.relation?.direction === 'two-way' ? ('two-way' as const) : ('one-way' as const),
          description: str(raw.relation?.description),
          protocol: str(raw.relation?.protocol),
          payload: str(raw.relation?.payload),
          metadata: strRecord(raw.relation?.metadata),
          createdAt: ts,
          updatedAt: ts
        }
        m.relations.push(rel)
        touched.relations.add(rel.id)
        break
      }
      case 'update_relation': {
        const i = relIdx(raw.id)
        if (i < 0) return fail(`update_relation: relation not found: ${raw.id}`)
        const p = raw.patch ?? {}
        const r = m.relations[i]
        if (p.sourceId !== undefined) {
          if (nodeIdx(String(p.sourceId)) < 0) return fail('update_relation: source not found')
          r.sourceId = String(p.sourceId)
        }
        if (p.targetId !== undefined) {
          if (nodeIdx(String(p.targetId)) < 0) return fail('update_relation: target not found')
          r.targetId = String(p.targetId)
        }
        if (r.sourceId === r.targetId) return fail('update_relation: self-loops are not allowed')
        if (p.type !== undefined) r.type = str(p.type, r.type)
        if (p.direction !== undefined)
          r.direction = p.direction === 'two-way' ? 'two-way' : 'one-way'
        if (p.description !== undefined) r.description = str(p.description)
        if (p.protocol !== undefined) r.protocol = str(p.protocol)
        if (p.payload !== undefined) r.payload = str(p.payload)
        if (p.metadata !== undefined) r.metadata = strRecord(p.metadata)
        r.updatedAt = ts
        touched.relations.add(r.id)
        break
      }
      case 'delete_relation': {
        const i = relIdx(raw.id)
        if (i < 0) return fail(`delete_relation: relation not found: ${raw.id}`)
        m.relations.splice(i, 1)
        touched.relations.add(raw.id)
        break
      }
      case 'create_group': {
        const name = str(raw.group?.name).trim()
        if (!name) return fail('create_group: name is required')
        let gid = idOf('g')
        if (typeof raw.group?.id === 'string' && raw.group.id && grpIdx(raw.group.id) < 0) {
          gid = raw.group.id
        }
        const g = {
          id: gid,
          name,
          description: str(raw.group?.description),
          color: str(raw.group?.color, '#6366f1'),
          createdAt: ts,
          updatedAt: ts
        }
        m.groups.push(g)
        touched.groups.add(g.id)
        break
      }
      case 'update_group': {
        const i = grpIdx(raw.id)
        if (i < 0) return fail(`update_group: group not found: ${raw.id}`)
        const g = m.groups[i]
        const p = raw.patch ?? {}
        if (p.name !== undefined) g.name = str(p.name, g.name).trim() || g.name
        if (p.description !== undefined) g.description = str(p.description)
        if (p.color !== undefined) g.color = str(p.color, g.color)
        g.updatedAt = ts
        touched.groups.add(g.id)
        break
      }
      case 'delete_group': {
        const i = grpIdx(raw.id)
        if (i < 0) return fail(`delete_group: group not found: ${raw.id}`)
        m.groups.splice(i, 1)
        for (const n of m.nodes) if (n.groupId === raw.id) n.groupId = null
        touched.groups.add(raw.id)
        break
      }
      case 'create_artifact': {
        const title = str(raw.artifact?.title).trim()
        const category = asArtifactCategory(raw.artifact?.category)
        if (!title) return fail('create_artifact: title is required')
        if (!category) return fail(`create_artifact: invalid category: ${str(raw.artifact?.category)}`)
        const nodeIds = strArray(raw.artifact?.nodeIds)
          .map((ref) => resolveNodeRef(ref))
          .filter((id): id is string => Boolean(id))
        const a = {
          id: idOf('art'),
          title,
          category,
          content: str(raw.artifact?.content),
          nodeIds,
          derived:
            raw.artifact?.derived === 'ai' ||
            raw.artifact?.derived === 'manual' ||
            raw.artifact?.derived === 'mcp' ||
            raw.artifact?.derived === 'template'
              ? raw.artifact.derived
              : 'manual',
          createdAt: ts,
          updatedAt: ts
        }
        m.artifacts.push(a)
        touched.artifacts.add(a.id)
        break
      }
      case 'update_artifact': {
        const i = artIdx(raw.id)
        if (i < 0) return fail(`update_artifact: artifact not found: ${raw.id}`)
        const a = m.artifacts[i]
        const p = raw.patch ?? {}
        if (p.title !== undefined) a.title = str(p.title, a.title).trim() || a.title
        if (p.category !== undefined) {
          const c = asArtifactCategory(p.category)
          if (!c) return fail(`update_artifact: invalid category: ${str(p.category)}`)
          a.category = c
        }
        if (p.content !== undefined) a.content = str(p.content)
        if (p.nodeIds !== undefined)
          a.nodeIds = strArray(p.nodeIds)
            .map((ref) => resolveNodeRef(ref))
            .filter((id): id is string => Boolean(id))
        if (p.derived !== undefined) a.derived = p.derived
        a.updatedAt = ts
        touched.artifacts.add(a.id)
        break
      }
      case 'delete_artifact': {
        const i = artIdx(raw.id)
        if (i < 0) return fail(`delete_artifact: artifact not found: ${raw.id}`)
        m.artifacts.splice(i, 1)
        touched.artifacts.add(raw.id)
        break
      }
      case 'set_position': {
        const i = nodeIdx(raw.id)
        if (i < 0) return fail(`set_position: node not found: ${raw.id}`)
        m.nodes[i].position = {
          x: Number(raw.position?.x) || 0,
          y: Number(raw.position?.y) || 0
        }
        m.nodes[i].updatedAt = ts
        touched.nodes.add(raw.id)
        break
      }
      default:
        return fail(`unknown op: ${(raw as { op?: string })?.op}`)
    }
  }

  model.nodes = m.nodes
  model.relations = m.relations
  model.groups = m.groups
  model.artifacts = m.artifacts
  return { ok: true, applied: ops.length, touched }
}

export function guessCategory(type: string): NodeCategory {
  return suggestCategory(type)
}

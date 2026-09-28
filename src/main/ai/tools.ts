import { ArchiModel, Op, OP_KINDS } from '../../shared/types'

/** Tool exposed to the AI: a single batched proposal of structured operations. */
export const PROPOSE_TOOL = {
  type: 'function',
  function: {
    name: 'propose_architecture_changes',
    description:
      'Propose a batch of structured changes to the software architecture. ' +
      'Use this tool whenever the user asks to create, modify or delete components, ' +
      'relations, groups or artifacts. Changes are shown to the user as a reviewable proposal.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title of the proposed change, e.g. "Add Redis cache layer"'
        },
        summary: {
          type: 'string',
          description: 'One-paragraph explanation of what changes and why'
        },
        ops: {
          type: 'array',
          description: 'Ordered list of operations to apply',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                enum: [
                  'create_node',
                  'update_node',
                  'delete_node',
                  'create_relation',
                  'update_relation',
                  'delete_relation',
                  'create_group',
                  'update_group',
                  'delete_group',
                  'create_artifact',
                  'update_artifact',
                  'delete_artifact'
                ]
              }
            },
            additionalProperties: true
          }
        }
      },
      required: ['title', 'summary', 'ops']
    }
  }
}

function findIdByName(model: ArchiModel, name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return null
  const key = name.trim().toLowerCase()
  const hits = model.nodes.filter((n) => n.name.toLowerCase() === key)
  return hits.length === 1 ? hits[0].id : null
}

function resolveRef(
  model: ArchiModel,
  raw: Record<string, unknown>,
  idKeys: string[],
  nameKeys: string[]
): string | null {
  for (const k of idKeys) {
    const v = raw[k]
    if (typeof v === 'string' && model.nodes.some((n) => n.id === v)) return v
    if (typeof v === 'string' && model.relations.some((r) => r.id === v)) return v
    if (typeof v === 'string' && model.groups.some((g) => g.id === v)) return v
    if (typeof v === 'string' && model.artifacts.some((a) => a.id === v)) return v
  }
  for (const k of nameKeys) {
    const v = findIdByName(model, raw[k])
    if (v) return v
  }
  return null
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function strArr(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
}

/**
 * Convert raw (AI/MCP-supplied) operations into validated typed ops.
 * Node references may be given by id or by unique name. Unknown ops are dropped.
 * Returns null when nothing usable remains.
 */
export function sanitizeOps(model: ArchiModel, rawOps: unknown): Op[] | null {
  if (!Array.isArray(rawOps)) return null
  const out: Op[] = []
  for (const raw of rawOps.slice(0, 60)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const kind = r.op
    if (typeof kind !== 'string' || !OP_KINDS.includes(kind as Op['op'])) continue
    const data = (r.node ?? r.relation ?? r.group ?? r.artifact ?? r) as Record<string, unknown>

    switch (kind as Op['op']) {
      case 'create_node': {
        const name = str(data.name)?.trim()
        if (!name) continue
        out.push({
          op: 'create_node',
          node: {
            name,
            type: str(data.type) ?? 'generic',
            category: str(data.category) as never,
            description: str(data.description) ?? '',
            responsibilities: strArr(data.responsibilities) ?? [],
            technology: str(data.technology) ?? '',
            tags: strArr(data.tags) ?? [],
            groupId: str(data.group),
            position: {
              x: Number((data.position as { x?: number })?.x) || rand(-80, 80),
              y: Number((data.position as { y?: number })?.y) || rand(-80, 80)
            }
          }
        })
        break
      }
      case 'update_node': {
        const id = resolveRef(model, r, ['id'], ['name', 'nodeName'])
        if (!id) continue
        const patch: Record<string, unknown> = {}
        if (data.name !== undefined) patch.name = data.name
        if (data.type !== undefined) patch.type = data.type
        if (data.category !== undefined) patch.category = data.category
        if (data.description !== undefined) patch.description = data.description
        if (data.responsibilities !== undefined) patch.responsibilities = data.responsibilities
        if (data.technology !== undefined) patch.technology = data.technology
        if (data.tags !== undefined) patch.tags = data.tags
        out.push({ op: 'update_node', id, patch: patch as never })
        break
      }
      case 'delete_node': {
        const id = resolveRef(model, r, ['id'], ['name', 'nodeName'])
        if (!id) continue
        out.push({ op: 'delete_node', id })
        break
      }
      case 'create_relation': {
        const sourceId =
          resolveRef(model, r, ['sourceId'], ['sourceName', 'source', 'from']) ??
          resolveRef(model, data, ['sourceId'], ['sourceName', 'source', 'from']) ??
          str(data.sourceName ?? data.source ?? r.sourceName ?? r.source)
        const targetId =
          resolveRef(model, r, ['targetId'], ['targetName', 'target', 'to']) ??
          resolveRef(model, data, ['targetId'], ['targetName', 'target', 'to']) ??
          str(data.targetName ?? data.target ?? r.targetName ?? r.target)
        if (!sourceId || !targetId) continue
        out.push({
          op: 'create_relation',
          relation: {
            sourceId,
            targetId,
            type: str(data.type) ?? 'dependency',
            direction: str(data.direction) === 'two-way' ? 'two-way' : 'one-way',
            description: str(data.description) ?? '',
            protocol: str(data.protocol) ?? '',
            payload: str(data.payload) ?? ''
          }
        })
        break
      }
      case 'update_relation': {
        const id = typeof r.id === 'string' && model.relations.some((x) => x.id === r.id) ? r.id : null
        if (!id) continue
        const patch: Record<string, unknown> = {}
        for (const k of ['type', 'description', 'protocol', 'payload', 'direction'])
          if (data[k] !== undefined) patch[k] = data[k]
        out.push({ op: 'update_relation', id, patch: patch as never })
        break
      }
      case 'delete_relation': {
        const id = typeof r.id === 'string' && model.relations.some((x) => x.id === r.id) ? r.id : null
        if (!id) continue
        out.push({ op: 'delete_relation', id })
        break
      }
      case 'create_group': {
        const name = str(data.name)?.trim()
        if (!name) continue
        out.push({
          op: 'create_group',
          group: { name, description: str(data.description) ?? '' }
        })
        break
      }
      case 'update_group':
      case 'delete_group': {
        const id =
          typeof r.id === 'string' && model.groups.some((g) => g.id === r.id) ? r.id : null
        if (!id) continue
        if (kind === 'update_group') {
          const patch: Record<string, unknown> = {}
          if (data.name !== undefined) patch.name = data.name
          if (data.description !== undefined) patch.description = data.description
          out.push({ op: 'update_group', id, patch: patch as never })
        } else {
          out.push({ op: 'delete_group', id })
        }
        break
      }
      case 'create_artifact': {
        const title = str(data.title)?.trim()
        const category = str(data.category)
        if (!title || !category) continue
        out.push({
          op: 'create_artifact',
          artifact: {
            title,
            category: category as never,
            content: str(data.content) ?? '',
            nodeIds: strArr(data.nodeIds) ?? strArr(data.linkedNodes) ?? [],
            derived: 'ai'
          }
        })
        break
      }
      case 'update_artifact': {
        const id =
          typeof r.id === 'string' && model.artifacts.some((a) => a.id === r.id) ? r.id : null
        if (!id) continue
        const patch: Record<string, unknown> = {}
        if (data.title !== undefined) patch.title = data.title
        if (data.content !== undefined) patch.content = data.content
        if (data.category !== undefined) patch.category = data.category
        if (data.nodeIds !== undefined) patch.nodeIds = data.nodeIds
        out.push({ op: 'update_artifact', id, patch: patch as never })
        break
      }
      case 'delete_artifact': {
        const id =
          typeof r.id === 'string' && model.artifacts.some((a) => a.id === r.id) ? r.id : null
        if (!id) continue
        out.push({ op: 'delete_artifact', id })
        break
      }
      default:
        break
    }
  }
  return out.length > 0 ? out : null
}

function rand(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}

import { ArchiModel, ValidationIssue } from '../shared/types'
import { newId } from '../shared/ids'

function findCycle(nodes: { id: string }[], edges: { from: string; to: string }[]): string[][] {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from)!.push(e.to)
  }
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const stack: string[] = []
  const cycles: string[][] = []

  const dfs = (n: string) => {
    if (inStack.has(n)) {
      const start = stack.indexOf(n)
      cycles.push(stack.slice(start))
      return
    }
    if (visited.has(n)) return
    visited.add(n)
    inStack.add(n)
    stack.push(n)
    for (const next of adj.get(n) ?? []) dfs(next)
    stack.pop()
    inStack.delete(n)
  }
  for (const n of nodes) dfs(n.id)
  return cycles
}

/**
 * Structural checks over the architecture model (PRD §18).
 * Errors break referential integrity; warnings flag design smells.
 */
export function validateModel(model: ArchiModel): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const issue = (i: Omit<ValidationIssue, 'id'>) => issues.push({ id: newId('iss'), ...i })

  const byId = new Map(model.nodes.map((n) => [n.id, n]))

  // 1. relations pointing to missing nodes (error)
  for (const r of model.relations) {
    const missing: string[] = []
    if (!byId.has(r.sourceId)) missing.push(r.sourceId)
    if (!byId.has(r.targetId)) missing.push(r.targetId)
    if (missing.length > 0) {
      issue({
        severity: 'error',
        code: 'dangling_relation',
        message: `La relazione «${r.type}» fa riferimento a componenti inesistenti: ${missing.join(', ')}`,
        relationIds: [r.id]
      })
    }
  }

  // 2. duplicate component names (warning)
  const byName = new Map<string, string[]>()
  for (const n of model.nodes) {
    const key = n.name.trim().toLowerCase()
    byName.set(key, [...(byName.get(key) ?? []), n.id])
  }
  for (const [name, ids] of byName) {
    if (ids.length > 1) {
      issue({
        severity: 'warning',
        code: 'duplicate_name',
        message: `Nome componente duplicato «${name}» (${ids.length} componenti lo condividono)`,
        nodeIds: ids
      })
    }
  }

  // 3. components without responsibilities (warning)
  for (const n of model.nodes) {
    if (!n.description.trim() && n.responsibilities.length === 0) {
      issue({
        severity: 'warning',
        code: 'no_responsibility',
        message: `«${n.name}» non ha descrizione né responsabilità documentate`,
        nodeIds: [n.id]
      })
    }
  }

  // 4. orphan components: no relations at all (warning)
  const connected = new Set<string>()
  for (const r of model.relations) {
    connected.add(r.sourceId)
    connected.add(r.targetId)
  }
  for (const n of model.nodes) {
    if (!connected.has(n.id)) {
      issue({
        severity: 'warning',
        code: 'orphan_node',
        message: `«${n.name}» non ha connessioni con altri componenti`,
        nodeIds: [n.id]
      })
    }
  }

  // 5. circular dependencies (warning)
  const cycles = findCycle(
    model.nodes,
    model.relations.map((r) => ({ from: r.sourceId, to: r.targetId }))
  )
  for (const cycle of cycles.slice(0, 10)) {
    const names = cycle.map((id) => byId.get(id)?.name ?? id)
    issue({
      severity: 'warning',
      code: 'circular_dependency',
      message: `Dipendenza circolare: ${names.join(' → ')} → ${names[0]}`,
      nodeIds: cycle
    })
  }

  // 6. artifact integrity
  for (const a of model.artifacts) {
    const missing = a.nodeIds.filter((id) => !byId.has(id))
    if (missing.length > 0) {
      issue({
        severity: 'error',
        code: 'artifact_dangling_reference',
        message: `L'artefatto «${a.title}» fa riferimento a componenti inesistenti: ${missing.join(', ')}`,
        artifactIds: [a.id]
      })
    }
    if (a.nodeIds.length === 0) {
      issue({
        severity: 'warning',
        code: 'artifact_unlinked',
        message: `L'artefatto «${a.title}» non è collegato ad alcun componente`,
        artifactIds: [a.id]
      })
    }
  }

  // 7. artifacts not linked (warning) — covered above; here: components never described anywhere
  const described = new Set(model.artifacts.flatMap((a) => a.nodeIds))
  for (const n of model.nodes) {
    if (byId.get(n.id) && !described.has(n.id) && (n.type === 'api' || n.type === 'backend')) {
      // informational only — skip to avoid noise in MVP
    }
  }

  return issues
}

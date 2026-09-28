import { ArchiModel, AiContextRequest } from '../shared/types'

function compactNode(n: ArchiModel['nodes'][number]) {
  return {
    id: n.id,
    name: n.name,
    type: n.type,
    technology: n.technology,
    description: n.description,
    responsibilities: n.responsibilities,
    tags: n.tags
  }
}

/**
 * Build the textual context handed to the AI for the current selection.
 * Selection-driven: selected nodes in full, plus their direct neighborhood.
 */
export function buildAiContext(model: ArchiModel, sel: AiContextRequest): string {
  const byId = new Map(model.nodes.map((n) => [n.id, n]))

  if (sel.wholeProject || sel.nodeIds.length === 0) {
    return JSON.stringify(
      {
        selection: 'whole project',
        nodes: model.nodes.map(compactNode),
        relations: model.relations.map((r) => ({
          from: byId.get(r.sourceId)?.name ?? r.sourceId,
          to: byId.get(r.targetId)?.name ?? r.targetId,
          type: r.type,
          protocol: r.protocol || undefined,
          description: r.description || undefined
        })),
        groups: model.groups.map((g) => ({ name: g.name, description: g.description })),
        artifacts: model.artifacts.map((a) => ({
          title: a.title,
          category: a.category,
          linkedNodes: a.nodeIds.map((id) => byId.get(id)?.name ?? id)
        }))
      },
      null,
      1
    )
  }

  const selected = sel.nodeIds.map((id) => byId.get(id)).filter((n): n is NonNullable<typeof n> => Boolean(n))
  const selIds = new Set(selected.map((n) => n.id))
  const neighborIds = new Set<string>()
  for (const r of model.relations) {
    if (selIds.has(r.sourceId)) neighborIds.add(r.targetId)
    if (selIds.has(r.targetId)) neighborIds.add(r.sourceId)
  }
  const relevantRels = model.relations.filter(
    (r) => selIds.has(r.sourceId) || selIds.has(r.targetId)
  )
  const linkedArtifacts = model.artifacts.filter((a) => a.nodeIds.some((id) => selIds.has(id)))

  return JSON.stringify(
    {
      selection: {
        nodes: selected.map(compactNode),
        connectedComponents: [...neighborIds]
          .filter((id) => !selIds.has(id))
          .map((id) => {
            const n = byId.get(id)
            return n ? { id: n.id, name: n.name, type: n.type } : { id }
          }),
        relations: relevantRels.map((r) => ({
          from: byId.get(r.sourceId)?.name ?? r.sourceId,
          to: byId.get(r.targetId)?.name ?? r.targetId,
          type: r.type,
          direction: r.direction,
          protocol: r.protocol || undefined,
          payload: r.payload || undefined,
          description: r.description || undefined
        })),
        linkedArtifacts: linkedArtifacts.map((a) => ({
          title: a.title,
          category: a.category
        }))
      },
      projectTotals: {
        nodes: model.nodes.length,
        relations: model.relations.length,
        artifacts: model.artifacts.length
      }
    },
    null,
    1
  )
}

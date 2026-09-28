import { ArchiModel, ArchiNode, ArchiRelation, Op } from '../../../shared/types'

// fallback browser-friendly (ids.ts usa node:crypto, disponibile solo nel main)
const fallbackId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`

export interface ClipboardContent {
  nodes: ArchiNode[]
  relations: Pick<ArchiRelation, 'sourceId' | 'targetId' | 'type' | 'direction' | 'description' | 'protocol' | 'payload'>[]
}

/**
 * Costruisce le ops per incollare un clipboard: clona i nodi con nuovi id
 * (posizione scalata di un offset) e ricollega le relazioni interne.
 * Puro e testabile: l'idFactory è iniettabile.
 */
export function buildPasteOps(
  clipboard: ClipboardContent,
  offset: { x: number; y: number },
  idFactory: (prefix: string) => string = fallbackId
): { ops: Op[]; idByOld: Map<string, string>; pastedIds: string[] } {
  const idByOld = new Map<string, string>()
  const ops: Op[] = []
  const ts = new Date().toISOString()

  for (const n of clipboard.nodes) {
    const newIdVal = idFactory('n')
    idByOld.set(n.id, newIdVal)
    ops.push({
      op: 'create_node',
      node: {
        id: newIdVal,
        name: n.name,
        type: n.type,
        category: n.category,
        description: n.description,
        responsibilities: [...n.responsibilities],
        technology: n.technology,
        tags: [...n.tags],
        properties: { ...n.properties },
        groupId: n.groupId,
        position: { x: n.position.x + offset.x, y: n.position.y + offset.y }
      } as never
    })
  }

  for (const r of clipboard.relations) {
    const sourceId = idByOld.get(r.sourceId)
    const targetId = idByOld.get(r.targetId)
    if (!sourceId || !targetId) continue // un estremo non è stato copiato
    ops.push({
      op: 'create_relation',
      relation: {
        sourceId,
        targetId,
        type: r.type,
        direction: r.direction,
        description: r.description,
        protocol: r.protocol,
        payload: r.payload
      }
    })
  }

  return { ops, idByOld, pastedIds: [...idByOld.values()] }
}

/** Estrae il clipboard dai nodi selezionati del modello (nessuna relazione orfana). */
export function extractClipboard(model: ArchiModel, nodeIds: string[]): ClipboardContent | null {
  const set = new Set(nodeIds)
  const nodes = model.nodes.filter((n) => set.has(n.id))
  if (nodes.length === 0) return null
  const relations = model.relations
    .filter((r) => set.has(r.sourceId) && set.has(r.targetId))
    .map((r) => ({
      sourceId: r.sourceId,
      targetId: r.targetId,
      type: r.type,
      direction: r.direction,
      description: r.description,
      protocol: r.protocol,
      payload: r.payload
    }))
  return { nodes, relations }
}

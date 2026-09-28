import {
  ArchiArtifact,
  ArchiModel,
  ArchiNode,
  ArtifactCategory
} from '../shared/types'

function nodeById(model: ArchiModel, id: string): ArchiNode | undefined {
  return model.nodes.find((n) => n.id === id)
}

function label(n: ArchiNode | undefined): string {
  return n ? `${n.name} (${n.type})` : 'sconosciuto'
}

function relTable(
  model: ArchiModel,
  nodeId: string,
  dir: 'in' | 'out'
): string {
  const rows = model.relations.filter((r) =>
    dir === 'in' ? r.targetId === nodeId : r.sourceId === nodeId
  )
  if (rows.length === 0) return '_Nessuna._\n'
  const head = '| Da | Tipo | Protocollo | Payload / Note |'
  const sep = '|---|---|---|---|'
  const body = rows
    .map((r) => {
      const other = nodeById(model, dir === 'in' ? r.sourceId : r.targetId)
      return `| ${label(other)} | ${r.type}${r.direction === 'two-way' ? ' (bidirezionale)' : ''} | ${r.protocol || '—'} | ${r.payload || r.description || '—'} |`
    })
    .join('\n')
  return `${head}\n${sep}\n${body}\n`
}

export function componentSpec(model: ArchiModel, node: ArchiNode): string {
  return `# Specifica Componente — ${node.name}

> Generata automaticamente dal modello architetturale. Modificabile liberamente; il modello resta la source of truth.

## Panoramica

- **Tipo:** ${node.type}
- **Categoria:** ${node.category}
- **Tecnologia:** ${node.technology || '_da definire_'}
- **Tag:** ${node.tags.length ? node.tags.join(', ') : '_nessuno_'}

${node.description || '_Aggiungi una breve descrizione di questo componente._'}

## Responsabilità

${
  node.responsibilities.length
    ? node.responsibilities.map((r) => `- ${r}`).join('\n')
    : '- _Definisci le responsabilità di questo componente._'
}

## Interfacce (in ingresso)

${relTable(model, node.id, 'in')}

## Interfacce (in uscita)

${relTable(model, node.id, 'out')}

## Strategia di errore

_Documenta cosa accade quando questo componente si guasta: retry, timeout, fallback, modalità degradata._

## Note

${Object.entries(node.properties)
  .map(([k, v]) => `- **${k}:** ${v}`)
  .join('\n') || '_Proprietà aggiuntive e vincoli._'}
`
}

export function systemSpec(model: ArchiModel): string {
  const groups = model.groups.map((g) => `- **${g.name}:** ${model.nodes.filter((n) => n.groupId === g.id).length} componente/i`).join('\n')
  const inventory =
    model.nodes.length === 0
      ? '_Nessun componente presente._'
      : [
          '| Componente | Tipo | Tecnologia | Responsabilità |',
          '|---|---|---|---|',
          ...model.nodes.map(
            (n) =>
              `| ${n.name} | ${n.type} | ${n.technology || '—'} | ${n.responsibilities.slice(0, 2).join('; ') || n.description.slice(0, 60) || '—'} |`
          )
        ].join('\n')
  const relations =
    model.relations.length === 0
      ? '_Nessuna relazione presente._'
      : [
          '| Da | Tipo | A | Protocollo |',
          '|---|---|---|---|',
          ...model.relations.map(
            (r) =>
              `| ${label(nodeById(model, r.sourceId))} | ${r.type} | ${label(nodeById(model, r.targetId))} | ${r.protocol || '—'} |`
          )
        ].join('\n')
  return `# Specifica di Sistema

> Generata automaticamente dal modello architetturale.

## Panoramica

Questo documento descrive il sistema così com'è progettato nella canvas architetturale.

- **Componenti:** ${model.nodes.length}
- **Relazioni:** ${model.relations.length}
- **Gruppi:** ${model.groups.length}
- **Artefatti:** ${model.artifacts.length}

## Inventario componenti

${inventory}

## Mappa delle interazioni

${relations}

## Raggruppamenti

${groups || '_Nessun gruppo definito._'}
`
}

export function apiSpec(model: ArchiModel, node: ArchiNode): string {
  const consumers = model.relations
    .filter((r) => r.targetId === node.id && ['http', 'rest', 'graphql', 'websocket'].includes(r.type))
    .map((r) => nodeById(model, r.sourceId))
  return `# Specifica API — ${node.name}

> Scheletro generato automaticamente. Compila i dettagli degli endpoint o chiedi all'Architetto AI di redigerli.

## Scopo

${node.description || '_Descrivi lo scopo di questa API._'}

## Consumatori

${consumers.length ? consumers.map((c) => `- ${label(c)}`).join('\n') : '_Nessun consumatore collegato._'}

## Autenticazione

_Documenta lo schema di autenticazione (es. JWT bearer, API key, OAuth2)._

## Endpoint

| Metodo | Percorso | Descrizione | Richiesta | Risposta | Errori |
|---|---|---|---|---|---|
| GET | /example | _descrivi_ | _schema_ | _schema_ | 400, 404 |

## Gestione errori

| Codice | Significato | Payload |
|---|---|---|
| 400 | Richiesta non valida | \`{ "error": "..." }\` |

## Rate limiting e quote

_Da definire._
`
}

export function databaseSpec(model: ArchiModel, dbNodes: ArchiNode[]): string {
  const accessRows = dbNodes.flatMap((db) =>
    model.relations
      .filter((r) => r.targetId === db.id)
      .map((r) => `| ${label(nodeById(model, r.sourceId))} | ${db.name} | ${r.payload || '—'} |`)
  )
  return `# Schema Database

> Scheletro generato dai componenti database presenti nel modello.

## Database

${dbNodes.map((d) => `- **${d.name}** — ${d.technology || 'tecnologia da definire'}: ${d.description || 'nessuna descrizione'}`).join('\n') || '_Nessun componente database nel modello._'}

## Mappa degli accessi

| Client | Database | Dati / Payload |
|---|---|---|
${accessRows.join('\n') || '| — | — | — |'}

## Entità

_Per ogni entità: nome, campi, tipi, vincoli, indici._

\`\`\`
entity User {
  id: uuid [pk]
  email: string [unique, not null]
  created_at: timestamp
}
\`\`\`

## Vincoli e migrazioni

_Documenta regole di unicità, foreign key e la strategia di migrazione._
`
}

export function dataflowSpec(model: ArchiModel, from?: string, to?: string): string {
  const byId = new Map(model.nodes.map((n) => [n.id, n]))
  const adj = new Map<string, { to: string; relType: string }[]>()
  for (const r of model.relations) {
    adj.set(r.sourceId, [...(adj.get(r.sourceId) ?? []), { to: r.targetId, relType: r.type }])
  }
  const paths: { nodes: string[]; rels: string[] }[] = []
  const maxPaths = 20
  const dfs = (current: string, target: string | null, nodes: string[], rels: string[]) => {
    if (paths.length >= maxPaths) return
    if (target && current === target && nodes.length > 1) {
      paths.push({ nodes: [...nodes], rels: [...rels] })
      return
    }
    if (!target && nodes.length > 1) paths.push({ nodes: [...nodes], rels: [...rels] })
    if (nodes.length > 8) return
    for (const edge of adj.get(current) ?? []) {
      if (nodes.includes(edge.to)) continue
      dfs(edge.to, target, [...nodes, edge.to], [...rels, edge.relType])
    }
  }
  const sources = from ? [from] : model.nodes.map((n) => n.id)
  for (const s of sources) dfs(s, to ?? null, [s], [])

  const flow = paths.length
    ? paths
        .map((p, i) => `${i + 1}. ${p.nodes.map((id) => byId.get(id)?.name ?? id).join(' → ')}  \n   _tramite ${p.rels.join(', ')}_`)
        .join('\n')
    : '_Nessun flusso completo trovato (collega i componenti nella canvas)._'
  return `# Flusso di Dati

> Generato dal modello architetturale${from || to ? ' (filtrato)' : ''}.

## Flussi principali

${flow}

## Classificazione dei dati

_Classifica i dati che transitano in ogni flusso: PII, finanziari, telemetria, interni._

## Asincrono vs sincrono

_Indica quali passi sono chiamate sincrone e quali event-driven._
`
}

export function adrSpec(title: string, model: ArchiModel): string {
  const n = model.artifacts.filter((a) => a.category === 'adr').length + 1
  const num = `ADR-${String(n).padStart(3, '0')}`
  return `# ${num} — ${title}

## Stato

Proposta

## Contesto

_Qual è il problema che motiva questa decisione o questo cambiamento?_

## Decisione

_Qual è il cambiamento che si propone o su cui si è concordato?_

## Opzioni considerate

| Opzione | Pro | Contro |
|---|---|---|
| _Opzione A_ | | |
| _Opzione B_ | | |

## Conseguenze

_Cosa diventa più facile o più difficile grazie a questo cambiamento?_
`
}

export function requirementsSpec(model: ArchiModel): string {
  const functional = model.nodes
    .flatMap((n) => n.responsibilities.map((r) => `- [ ] **${n.name}:** ${r}`))
    .join('\n')
  return `# Requisiti

> Scheletro generato automaticamente. Le voci funzionali derivano dalle responsabilità dei componenti.

## Requisiti funzionali

${functional || '- [ ] _Definisci i requisiti funzionali del sistema._'}

## Requisiti non funzionali

| Attributo | Obiettivo | Note |
|---|---|---|
| Disponibilità | _es. 99,9%_ | |
| Latenza | _es. p95 < 200ms_ | |
| Throughput | _es. 1000 rps_ | |
| Scalabilità | _es. 100k utenti contemporanei_ | |
| Sicurezza | _es. OWASP ASVS L2_ | |

## Vincoli

_Vincoli tecnici, legali e di business._
`
}

export function deploymentSpec(model: ArchiModel): string {
  const infra = model.nodes.filter((n) => n.category === 'infrastructure' || n.category === 'data')
  return `# Specifica di Deployment

> Scheletro generato dal modello architetturale.

## Ambienti

| Ambiente | Scopo | Note |
|---|---|---|
| development | sviluppo locale | |
| staging | validazione pre-produzione | |
| production | sistema live | |

## Componenti

${model.nodes.map((n) => `- **${n.name}** (${n.type})${n.technology ? ` — ${n.technology}` : ''}`).join('\n') || '_Nessun componente presente._'}

## Componenti infrastrutturali

${infra.map((n) => `- **${n.name}** (${n.type})`).join('\n') || '_Nessun componente infrastrutturale._'}

## Scaling e resilienza

_Documenta numero di repliche, regole di autoscaling, backup e disaster recovery._

## Osservabilità

_Strategia di metriche, log, trace e alerting._
`
}

export function generateArtifactContent(
  model: ArchiModel,
  category: ArtifactCategory,
  opts: { nodeId?: string; title?: string }
): { title: string; content: string; nodeIds: string[] } {
  const node = opts.nodeId ? nodeById(model, opts.nodeId) : undefined
  switch (category) {
    case 'component': {
      const target = node ?? model.nodes[0]
      if (!target) throw new Error('Prima crea un componente, poi genera la sua specifica.')
      return { title: opts.title ?? `${target.name} — Specifica Componente`, content: componentSpec(model, target), nodeIds: [target.id] }
    }
    case 'api': {
      const target =
        node ?? model.nodes.find((n) => n.type === 'api' || n.type === 'backend')
      if (!target) throw new Error('Nessun componente API/backend da documentare.')
      return { title: opts.title ?? `${target.name} — Specifica API`, content: apiSpec(model, target), nodeIds: [target.id] }
    }
    case 'system':
      return { title: opts.title ?? 'Specifica di Sistema', content: systemSpec(model), nodeIds: [] }
    case 'database':
      return {
        title: opts.title ?? 'Schema Database',
        content: databaseSpec(model, model.nodes.filter((n) => n.category === 'data')),
        nodeIds: model.nodes.filter((n) => n.category === 'data').map((n) => n.id)
      }
    case 'dataflow':
      return {
        title: opts.title ?? 'Flusso di Dati',
        content: dataflowSpec(model, opts.nodeId),
        nodeIds: opts.nodeId ? [opts.nodeId] : []
      }
    case 'adr': {
      const t = opts.title ?? 'Nuova decisione architetturale'
      const content = adrSpec(t.replace(/^ADR[- ]?\d*\s*—?\s*/i, ''), model)
      return { title: t, content, nodeIds: opts.nodeId ? [opts.nodeId] : [] }
    }
    case 'requirements':
      return { title: opts.title ?? 'Requisiti', content: requirementsSpec(model), nodeIds: [] }
    case 'deployment':
      return { title: opts.title ?? 'Specifica di Deployment', content: deploymentSpec(model), nodeIds: [] }
  }
}

export function newArtifact(
  title: string,
  category: ArtifactCategory,
  content: string,
  nodeIds: string[],
  derived: ArchiArtifact['derived']
): ArchiArtifact {
  const ts = new Date().toISOString()
  return {
    id: `art_${Math.random().toString(36).slice(2, 10)}`,
    title,
    category,
    content,
    nodeIds,
    derived,
    createdAt: ts,
    updatedAt: ts
  }
}

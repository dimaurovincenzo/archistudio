import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  ArchiModel,
  Op,
  Proposal
} from '../../shared/types'
import { ProjectStore } from '../store'
import { applyOps } from '../ops'
import { validateModel } from '../validation'
import { createSnapshot } from '../versioning'
import { sanitizeOps } from '../ai/tools'
import { newId, nowIso } from '../../shared/ids'

export type McpMode = 'read-only' | 'write' | 'approval'

/** Proposals created by this process, addressable by apply_changes. Module-level so it survives stateless HTTP (one server instance per request). */
export const mcpProposals = new Map<string, Proposal>()

export interface McpServerOptions {
  store: ProjectStore
  mode: McpMode
  clientLabel?: string
  onProposal?: (p: Proposal) => void
}

function text(data: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [
      { type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 1) }
    ]
  }
}

function errText(message: string) {
  return { content: [{ type: 'text' as const, text: `ERROR: ${message}` }], isError: true }
}

function publicModel(model: ArchiModel) {
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]))
  return {
    nodes: model.nodes,
    relations: model.relations.map((r) => ({
      ...r,
      source: nodeById.get(r.sourceId)?.name ?? r.sourceId,
      target: nodeById.get(r.targetId)?.name ?? r.targetId
    })),
    groups: model.groups,
    artifacts: model.artifacts.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      nodeIds: a.nodeIds,
      derived: a.derived,
      updatedAt: a.updatedAt,
      contentPreview: a.content.slice(0, 200)
    }))
  }
}

function resolveNode(model: ArchiModel, ref: string) {
  const byId = model.nodes.find((n) => n.id === ref)
  if (byId) return byId
  const exact = model.nodes.filter((n) => n.name.toLowerCase() === ref.trim().toLowerCase())
  return exact.length === 1 ? exact[0] : undefined
}

function resolveArtifact(model: ArchiModel, ref: string) {
  const byId = model.artifacts.find((a) => a.id === ref)
  if (byId) return byId
  const byTitle = model.artifacts.filter((a) => a.title.toLowerCase() === ref.trim().toLowerCase())
  if (byTitle.length === 1) return byTitle[0]
  return model.artifacts.find((a) => a.title.toLowerCase().includes(ref.trim().toLowerCase()))
}

const nodeRef = z.string().describe('Component id or exact unique name')

/**
 * Build the ArchiStudio MCP server: 18 tools + 5 resources over one ProjectStore.
 * Security modes (PRD §22):
 *  - read-only: write tools are refused
 *  - approval:  writes become pending proposals, applied after human approval in the app
 *  - write:     writes apply immediately (with an automatic safety snapshot)
 */
export function createArchiMcpServer(opts: McpServerOptions): McpServer {
  const { store, mode } = opts
  const server = new McpServer({ name: 'archistudio', version: '0.1.0' })
  const sessionProposalsRef = mcpProposals

  const readOnlyMsg = () =>
    `MCP server is in read-only mode. Ask the ArchiStudio owner to switch the MCP mode to "approval" or "write" in Settings.`
  const approvalMsg = () =>
    `MCP server is in approval mode: direct modifications are disabled. Use propose_changes to queue a proposal, then a human approves it inside ArchiStudio.`

  /** Returns a denied response when the current mode forbids direct writes, else null. */
  async function guardWrite(tool: string, args: unknown) {
    if (mode === 'read-only') {
      await audit(tool, args, false, 'read-only')
      return errText(readOnlyMsg())
    }
    if (mode === 'approval') {
      await audit(tool, args, false, 'approval mode: direct write refused')
      return errText(approvalMsg())
    }
    return null
  }

  async function audit(tool: string, args: unknown, ok: boolean, detail?: string) {
    await store
      .appendAudit({
        source: 'mcp',
        mode,
        client: opts.clientLabel ?? 'unknown',
        tool,
        ok,
        detail,
        args: JSON.stringify(args ?? {}).slice(0, 500)
      })
      .catch(() => {})
  }

  async function applyToStore(ops: Op[], sourceLabel: string): Promise<string | null> {
    await createSnapshot(store, store.model, `Before MCP change (${sourceLabel})`, 'mcp')
    const res = applyOps(store.model, ops)
    if (!res.ok) return res.error ?? 'operation failed'
    await store.persist()
    return null
  }

  async function queueProposal(
    title: string,
    summary: string,
    ops: Op[],
      clientInfo?: string
    ): Promise<Proposal> {
    const proposal: Proposal = {
      id: newId('pr'),
      title,
      summary,
      ops,
      source: 'mcp',
      clientInfo,
      createdAt: nowIso(),
      status: 'pending'
    }
    sessionProposalsRef.set(proposal.id, proposal)
    // persist to disk so the desktop app can show and approve it even if this server runs in a separate stdio process
    const pFile = store.proposalFile(proposal.id)
    await fs.mkdir(path.dirname(pFile), { recursive: true })
    await fs.writeFile(pFile, JSON.stringify(proposal), 'utf8')
    await store.appendAudit({
      source: 'mcp',
      mode,
      client: clientInfo ?? opts.clientLabel ?? 'unknown',
      tool: 'proposal',
      ok: true,
      detail: `queued proposal ${proposal.id} (${ops.length} ops)`
    })
    opts.onProposal?.(proposal)
    return proposal
  }

  // ---- read tools ------------------------------------------------------------

  server.registerTool(
    'get_project',
    { description: 'Get project metadata: name, description, entity counts and last update time.', inputSchema: {} },
    async () => {
      await audit('get_project', {}, true)
      return text({
        name: store.meta.name,
        description: store.meta.description,
        updatedAt: store.meta.updatedAt,
        counts: {
          nodes: store.model.nodes.length,
          relations: store.model.relations.length,
          groups: store.model.groups.length,
          artifacts: store.model.artifacts.length
        }
      })
    }
  )

  server.registerTool(
    'get_architecture',
    {
      description:
        'Get the full architecture model: components, relations (with resolved source/target names), groups and artifacts.'
    },
    async () => {
      await audit('get_architecture', {}, true)
      return text(publicModel(store.model))
    }
  )

  server.registerTool(
    'get_node',
    {
      description: 'Get one component in detail, including its inbound and outbound relations.',
      inputSchema: { node: nodeRef }
    },
    async ({ node }) => {
      const n = resolveNode(store.model, node)
      if (!n) {
        await audit('get_node', { node }, false, 'not found')
        return errText(`component not found: ${node}`)
      }
      await audit('get_node', { node }, true)
      return text({
        node: n,
        inbound: store.model.relations.filter((r) => r.targetId === n.id),
        outbound: store.model.relations.filter((r) => r.sourceId === n.id)
      })
    }
  )

  server.registerTool(
    'search_nodes',
    {
      description: 'Search components by name, type, technology, tag or description.',
      inputSchema: { query: z.string().describe('free text query'), type: z.string().optional() }
    },
    async ({ query, type }) => {
      const q = query.trim().toLowerCase()
      const hits = store.model.nodes.filter((n) => {
        if (type && n.type !== type) return false
        const hay = `${n.name} ${n.type} ${n.technology} ${n.tags.join(' ')} ${n.description}`.toLowerCase()
        return hay.includes(q)
      })
      await audit('search_nodes', { query, type }, true)
      return text(hits.map((n) => ({ id: n.id, name: n.name, type: n.type, technology: n.technology })))
    }
  )

  server.registerTool(
    'get_relationships',
    {
      description: 'List relations, optionally filtered by connected component or relation type.',
      inputSchema: { node: nodeRef.optional(), type: z.string().optional() }
    },
    async ({ node, type }) => {
      let rels = store.model.relations
      if (node) {
        const n = resolveNode(store.model, node)
        if (!n) return errText(`component not found: ${node}`)
        rels = rels.filter((r) => r.sourceId === n.id || r.targetId === n.id)
      }
      if (type) rels = rels.filter((r) => r.type === type)
      await audit('get_relationships', { node, type }, true)
      return text(publicModel({ ...store.model, relations: rels }).relations)
    }
  )

  server.registerTool(
    'get_artifact',
    {
      description: 'Get a documentation artifact by id or title (full markdown content).',
      inputSchema: { artifact: z.string().describe('artifact id or title') }
    },
    async ({ artifact }) => {
      const a = resolveArtifact(store.model, artifact)
      if (!a) {
        await audit('get_artifact', { artifact }, false, 'not found')
        return errText(`artifact not found: ${artifact}`)
      }
      await audit('get_artifact', { artifact }, true)
      return text(a)
    }
  )

  server.registerTool(
    'search_artifacts',
    {
      description: 'Search documentation artifacts by title, category or content.',
      inputSchema: { query: z.string().optional(), category: z.string().optional() }
    },
    async ({ query, category }) => {
      const q = query?.trim().toLowerCase()
      const hits = store.model.artifacts.filter(
        (a) =>
          (!category || a.category === category) &&
          (!q || `${a.title} ${a.category} ${a.content}`.toLowerCase().includes(q))
      )
      await audit('search_artifacts', { query, category }, true)
      return text(
        hits.map((a) => ({ id: a.id, title: a.title, category: a.category, nodeIds: a.nodeIds }))
      )
    }
  )

  server.registerTool(
    'validate_architecture',
    {
      description:
        'Run structural validation: dangling relations, circular dependencies, orphan components, missing responsibilities, unlinked artifacts.'
    },
    async () => {
      const issues = validateModel(store.model)
      await audit('validate_architecture', {}, true)
      return text({
        errors: issues.filter((i) => i.severity === 'error').length,
        warnings: issues.filter((i) => i.severity === 'warning').length,
        issues
      })
    }
  )

  // ---- write tools -----------------------------------------------------------

  server.registerTool(
    'create_node',
    {
      description: 'Create a new component. Requires write or approval mode.',
      inputSchema: {
        name: z.string(),
        type: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        technology: z.string().optional(),
        responsibilities: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        group: z.string().optional().describe('group id to attach the node to'),
        position: z.object({ x: z.number(), y: z.number() }).optional()
      }
    },
    async (args) => {
      const denied = await guardWrite('create_node', args)
      if (denied) return denied
      const op = { op: 'create_node', node: args } as Op
      const error = await applyToStore([op], `create_node ${args.name}`)
      await audit('create_node', args, !error, error ?? undefined)
      if (error) return errText(error)
      const created = store.model.nodes.find((n) => n.name === args.name)
      return text({ ok: true, node: created })
    }
  )

  server.registerTool(
    'update_node',
    {
      description: 'Update an existing component (name, type, description, technology, responsibilities, tags). Requires write or approval mode.',
      inputSchema: {
        node: nodeRef,
        name: z.string().optional(),
        type: z.string().optional(),
        description: z.string().optional(),
        technology: z.string().optional(),
        responsibilities: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional()
      }
    },
    async (args) => {
      const denied = await guardWrite('update_node', args)
      if (denied) return denied
      const n = resolveNode(store.model, args.node)
      if (!n) return errText(`component not found: ${args.node}`)
      const patch: Record<string, unknown> = {}
      for (const k of ['name', 'type', 'description', 'technology', 'responsibilities', 'tags'] as const)
        if (args[k] !== undefined) patch[k] = args[k]
      const error = await applyToStore([{ op: 'update_node', id: n.id, patch } as Op], `update_node ${n.name}`)
      await audit('update_node', args, !error, error ?? undefined)
      if (error) return errText(error)
      return text({ ok: true })
    }
  )

  server.registerTool(
    'delete_node',
    { description: 'Delete a component and its relations. Requires write or approval mode.', inputSchema: { node: nodeRef } },
    async (args) => {
      const denied = await guardWrite('delete_node', args)
      if (denied) return denied
      const n = resolveNode(store.model, args.node)
      if (!n) return errText(`component not found: ${args.node}`)
      const error = await applyToStore([{ op: 'delete_node', id: n.id }], `delete_node ${n.name}`)
      await audit('delete_node', args, !error, error ?? undefined)
      if (error) return errText(error)
      return text({ ok: true })
    }
  )

  server.registerTool(
    'create_relationship',
    {
      description: 'Create a relation between two components. Requires write or approval mode.',
      inputSchema: {
        source: z.string().describe('source component id or name'),
        target: z.string().describe('target component id or name'),
        type: z.string().optional(),
        direction: z.enum(['one-way', 'two-way']).optional(),
        description: z.string().optional(),
        protocol: z.string().optional(),
        payload: z.string().optional()
      }
    },
    async (args) => {
      const denied = await guardWrite('create_relationship', args)
      if (denied) return denied
      const s = resolveNode(store.model, args.source)
      const t = resolveNode(store.model, args.target)
      if (!s) return errText(`source not found: ${args.source}`)
      if (!t) return errText(`target not found: ${args.target}`)
      const op = {
        op: 'create_relation',
        relation: {
          sourceId: s.id,
          targetId: t.id,
          type: args.type ?? 'dependency',
          direction: args.direction,
          description: args.description,
          protocol: args.protocol,
          payload: args.payload
        }
      } as Op
      const error = await applyToStore([op], `create_relationship ${s.name}->${t.name}`)
      await audit('create_relationship', args, !error, error ?? undefined)
      if (error) return errText(error)
      return text({ ok: true })
    }
  )

  server.registerTool(
    'update_relationship',
    {
      description: 'Update a relation (type, protocol, payload, description, direction). Requires write or approval mode.',
      inputSchema: {
        id: z.string(),
        type: z.string().optional(),
        direction: z.enum(['one-way', 'two-way']).optional(),
        description: z.string().optional(),
        protocol: z.string().optional(),
        payload: z.string().optional()
      }
    },
    async (args) => {
      const denied = await guardWrite('update_relationship', args)
      if (denied) return denied
      const patch: Record<string, unknown> = {}
      for (const k of ['type', 'direction', 'description', 'protocol', 'payload'] as const)
        if (args[k] !== undefined) patch[k] = args[k]
      const error = await applyToStore([{ op: 'update_relation', id: args.id, patch } as Op], 'update_relationship')
      await audit('update_relationship', args, !error, error ?? undefined)
      if (error) return errText(error)
      return text({ ok: true })
    }
  )

  server.registerTool(
    'delete_relationship',
    { description: 'Delete a relation by id. Requires write or approval mode.', inputSchema: { id: z.string() } },
    async (args) => {
      const denied = await guardWrite('delete_relationship', args)
      if (denied) return denied
      const error = await applyToStore([{ op: 'delete_relation', id: args.id }], 'delete_relationship')
      await audit('delete_relationship', args, !error, error ?? undefined)
      if (error) return errText(error)
      return text({ ok: true })
    }
  )

  server.registerTool(
    'create_artifact',
    {
      description: 'Create a documentation artifact (requirements, system, component, api, database, dataflow, adr, deployment). Requires write or approval mode.',
      inputSchema: {
        title: z.string(),
        category: z.string(),
        content: z.string().optional().describe('markdown content'),
        linkedNodes: z.array(z.string()).optional().describe('component ids to link')
      }
    },
    async (args) => {
      const denied = await guardWrite('create_artifact', args)
      if (denied) return denied
      const op = {
        op: 'create_artifact',
        artifact: { ...args, derived: 'mcp' }
      } as Op
      const error = await applyToStore([op], `create_artifact ${args.title}`)
      await audit('create_artifact', args, !error, error ?? undefined)
      if (error) return errText(error)
      return text({ ok: true })
    }
  )

  server.registerTool(
    'update_artifact',
    {
      description: 'Update an artifact: title, markdown content, category or linked components. Requires write or approval mode.',
      inputSchema: {
        artifact: z.string().describe('artifact id or title'),
        title: z.string().optional(),
        content: z.string().optional(),
        category: z.string().optional(),
        linkedNodes: z.array(z.string()).optional()
      }
    },
    async (args) => {
      const denied = await guardWrite('update_artifact', args)
      if (denied) return denied
      const a = resolveArtifact(store.model, args.artifact)
      if (!a) return errText(`artifact not found: ${args.artifact}`)
      const patch: Record<string, unknown> = {}
      for (const k of ['title', 'content', 'category'] as const)
        if (args[k] !== undefined) patch[k] = args[k]
      if (args.linkedNodes !== undefined) patch.nodeIds = args.linkedNodes
      const error = await applyToStore([{ op: 'update_artifact', id: a.id, patch } as Op], 'update_artifact')
      await audit('update_artifact', args, !error, error ?? undefined)
      if (error) return errText(error)
      return text({ ok: true })
    }
  )

  // ---- proposal flow ----------------------------------------------------------

  server.registerTool(
    'propose_changes',
    {
      description:
        'Propose a batch of structured changes. The proposal is queued and must be applied with apply_changes (write mode) or approved by the human in ArchiStudio (approval mode).',
      inputSchema: {
        title: z.string(),
        summary: z.string(),
        ops: z
          .array(z.object({ op: z.string() }).passthrough())
          .describe('operations: create_node, update_node, delete_node, create_relation, update_relation, delete_relation, create_group, create_artifact, update_artifact…')
      }
    },
    async (args) => {
      // propose_changes is the queue path: allowed in write AND approval modes, refused only in read-only
      if (mode === 'read-only') {
        await audit('propose_changes', args, false, 'read-only')
        return errText(readOnlyMsg())
      }
      const ops = sanitizeOps(store.model, args.ops)
      if (!ops) {
        await audit('propose_changes', args, false, 'no valid ops')
        return errText('No valid operations found in the proposal. Check component names and op kinds.')
      }
      const proposal = await queueProposal(args.title, args.summary, ops, opts.clientLabel)
      return text({
        ok: true,
        proposalId: proposal.id,
        status: mode === 'write' ? 'pending — call apply_changes to apply' : 'pending human approval in ArchiStudio',
        opsCount: ops.length
      })
    }
  )

  server.registerTool(
    'apply_changes',
    {
      description:
        'Apply a previously proposed set of changes by proposal id. Only available in write mode; in approval mode the human approves inside ArchiStudio.',
      inputSchema: { proposalId: z.string() }
    },
    async (args) => {
      if (mode !== 'write') {
        await audit('apply_changes', args, false, `mode is ${mode}`)
        return errText(
          mode === 'approval'
            ? 'This server is in approval mode: approve the proposal inside ArchiStudio, then the change is applied.'
            : readOnlyMsg()
        )
      }
      // pending proposals created by propose_changes in this process
      const pending = sessionProposalsRef.get(args.proposalId)
      if (!pending) return errText(`proposal not found: ${args.proposalId}`)
      const error = await applyToStore(pending.ops, `apply_changes ${pending.title}`)
      await audit('apply_changes', args, !error, error ?? undefined)
      if (error) return errText(error)
      sessionProposalsRef.delete(args.proposalId)
      return text({ ok: true, appliedOps: pending.ops.length })
    }
  )

  // ---- resources ---------------------------------------------------------------

  const resource = (name: string, uri: string, pick: () => unknown) => {
    server.registerResource(
      name,
      uri,
      { mimeType: 'application/json' },
      async (uriObj) => ({
        contents: [{ uri: uriObj.href, mimeType: 'application/json', text: JSON.stringify(pick(), null, 1) }]
      })
    )
  }

  resource('project', 'architecture://project', () => ({
    name: store.meta.name,
    description: store.meta.description,
    updatedAt: store.meta.updatedAt,
    counts: {
      nodes: store.model.nodes.length,
      relations: store.model.relations.length,
      artifacts: store.model.artifacts.length
    }
  }))
  resource('nodes', 'architecture://nodes', () => store.model.nodes)
  resource('relationships', 'architecture://relationships', () =>
    publicModel(store.model).relations
  )
  resource('artifacts', 'architecture://artifacts', () =>
    store.model.artifacts.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      nodeIds: a.nodeIds,
      updatedAt: a.updatedAt
    }))
  )
  resource('decisions', 'architecture://decisions', () =>
    store.model.artifacts.filter((a) => a.category === 'adr')
  )

  return server
}

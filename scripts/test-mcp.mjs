#!/usr/bin/env node
/**
 * End-to-end test of the ArchiStudio MCP stdio server.
 * Spawns `node out/mcp/index.js` as a real MCP client would, speaks
 * newline-delimited JSON-RPC, and asserts tool behaviour in write and approval modes.
 *
 * Prereq: npm run build:mcp
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(repo, 'out', 'mcp', 'index.js')
let failures = 0

function ok(cond, label) {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${label}`)
  if (!cond) failures++
}

function tmpProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archi-mcp-'))
  fs.mkdirSync(path.join(root, 'architecture', 'nodes'), { recursive: true })
  fs.mkdirSync(path.join(root, 'architecture', 'relations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'architecture', 'groups'), { recursive: true })
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true })
  fs.mkdirSync(path.join(root, 'versions'), { recursive: true })
  const meta = { id: path.basename(root), name: 'MCP Test Project', description: 'e2e', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify(meta))
  return root
}

class McpClient {
  constructor(projectDir, mode) {
    this.proc = spawn('node', [entry, '--project', projectDir, '--mode', mode, '--client', 'e2e-test'], {
      env: process.env
    })
    this.nextId = 1
    this.pending = new Map()
    this.buffer = ''
    this.stderr = ''
    this.proc.stdout.setEncoding('utf8')
    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk
      let idx
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim()
        this.buffer = this.buffer.slice(idx + 1)
        if (!line) continue
        try {
          const msg = JSON.parse(line)
          if (msg.id && this.pending.has(msg.id)) {
            this.pending.get(msg.id)(msg)
            this.pending.delete(msg.id)
          }
        } catch {
          /* ignore */
        }
      }
    })
    this.proc.stderr.on('data', (d) => {
      this.stderr += d
    })
  }

  request(method, params) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout on ${method}`)), 15000)
      this.pending.set(id, (msg) => {
        clearTimeout(timer)
        resolve(msg)
      })
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }

  notify(method, params) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }

  async callTool(name, args) {
    return this.request('tools/call', { name, arguments: args ?? {} })
  }

  toolText(res) {
    try {
      return res.result.content.map((c) => c.text).join('\n')
    } catch {
      return ''
    }
  }

  close() {
    this.proc.kill()
  }
}

const PROTOCOL = '2025-06-18'

async function initialize(client) {
  const res = await client.request('initialize', {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: 'e2e-test', version: '0' }
  })
  client.notify('notifications/initialized', {})
  return res
}

async function testWriteMode() {
  console.log('\n== mode: write ==')
  const dir = tmpProject()
  const c = new McpClient(dir, 'write')
  const init = await initialize(c)
  ok(init.result.serverInfo.name === 'archistudio', 'initialize returns server info')

  const list = await c.request('tools/list', {})
  const names = list.result.tools.map((t) => t.name)
  const expected = [
    'get_project', 'get_architecture', 'get_node', 'search_nodes', 'create_node', 'update_node',
    'delete_node', 'get_relationships', 'create_relationship', 'update_relationship', 'delete_relationship',
    'get_artifact', 'search_artifacts', 'create_artifact', 'update_artifact', 'validate_architecture',
    'propose_changes', 'apply_changes'
  ]
  ok(expected.every((n) => names.includes(n)), `tools/list exposes all 18 PRD tools (${names.length})`)

  const resources = await c.request('resources/list', {})
  const uris = resources.result.resources.map((r) => r.uri)
  ok(
    ['architecture://project', 'architecture://nodes', 'architecture://relationships', 'architecture://artifacts', 'architecture://decisions'].every((u) => uris.includes(u)),
    'resources/list exposes the 5 architecture resources'
  )

  const created = await c.callTool('create_node', { name: 'Payment Service', type: 'backend', technology: 'Node.js', responsibilities: ['charge cards'] })
  ok(!created.result.isError, 'create_node applies in write mode')

  const byName = await c.callTool('create_node', { name: 'Ledger DB', type: 'database' })
  ok(!byName.result.isError, 'create_node second component')

  const rel = await c.callTool('create_relationship', { source: 'Payment Service', target: 'Ledger DB', type: 'db', protocol: 'SQL' })
  ok(!rel.result.isError, 'create_relationship resolves components by name')

  const arch = await c.callTool('get_architecture', {})
  ok(c.toolText(arch).includes('Payment Service') && c.toolText(arch).includes('Ledger DB'), 'get_architecture returns the created components')

  const node = await c.callTool('get_node', { node: 'Payment Service' })
  ok(c.toolText(node).includes('"db"'), 'get_node includes relations')

  const val = await c.callTool('validate_architecture', {})
  ok(c.toolText(val).includes('warnings'), 'validate_architecture runs (orphan warnings expected)')

  const files = fs.readdirSync(path.join(dir, 'architecture', 'nodes'))
  ok(files.length === 2, 'mutations are persisted to disk immediately')
  const audit = fs.readFileSync(path.join(dir, '.archi', 'audit.jsonl'), 'utf8')
  ok(audit.includes('"tool":"create_node"') && audit.includes('e2e-test'), 'audit log records client and tool')
  const snaps = fs.existsSync(path.join(dir, 'versions')) ? fs.readdirSync(path.join(dir, 'versions')) : []
  ok(snaps.length >= 1, 'automatic snapshot taken before MCP change')

  const ghost = await c.callTool('create_relationship', { source: 'Payment Service', target: 'Nope', type: 'db' })
  ok(ghost.result.isError === true, 'write to missing component returns a tool error')

  c.close()
}

async function testApprovalMode() {
  console.log('\n== mode: approval ==')
  const dir = tmpProject()
  const c = new McpClient(dir, 'approval')
  await initialize(c)

  const direct = await c.callTool('create_node', { name: 'Sneaky Service' })
  ok(direct.result.isError === true, 'direct write is refused in approval mode')

  const proposal = await c.callTool('propose_changes', {
    title: 'Add Redis cache',
    summary: 'Cache layer',
    ops: [
      { op: 'create_node', node: { name: 'Redis', type: 'cache' } },
      { op: 'create_node', node: { name: 'API', type: 'api' } },
      { op: 'create_relation', relation: { source: 'API', target: 'Redis', type: 'db' } }
    ]
  })
  ok(!proposal.result.isError, 'propose_changes queues a proposal')
  const proposalId = JSON.parse(c.toolText(proposal)).proposalId
  ok(Boolean(proposalId), 'proposal returns an id')

  const proposalFile = path.join(dir, '.archi', 'proposals', `${proposalId}.json`)
  ok(fs.existsSync(proposalFile), 'proposal persisted to .archi/proposals for human review')

  const applied = await c.callTool('apply_changes', { proposalId })
  ok(applied.result.isError === true, 'apply_changes is refused in approval mode')

  const nodesOnDisk = fs.readdirSync(path.join(dir, 'architecture', 'nodes'))
  ok(nodesOnDisk.length === 0, 'no mutation reached disk before approval')

  const ro = new McpClient(dir, 'read-only')
  await initialize(ro)
  const read = await ro.callTool('get_architecture', {})
  ok(!read.result.isError, 'read-only can read')
  const roWrite = await ro.callTool('propose_changes', { title: 'x', summary: 'y', ops: [{ op: 'create_node', node: { name: 'Z' } }] })
  ok(roWrite.result.isError === true, 'read-only refuses propose_changes')
  ro.close()

  c.close()
}

async function main() {
  console.log('ArchiStudio MCP e2e —', entry)
  await testWriteMode()
  await testApprovalMode()
  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('e2e fatal:', e)
  process.exit(1)
})

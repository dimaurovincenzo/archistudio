import http from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createArchiMcpServer, McpMode } from './server'
import { ProjectStore } from '../store'

export interface HttpMcpHandle {
  port: number
  close(): Promise<void>
}

/**
 * Stateless streamable-HTTP MCP endpoint bound to 127.0.0.1 with bearer-token auth.
 * One fresh McpServer+transport per request (SDK stateless pattern); the domain
 * store is shared, so all clients mutate the same project.
 */
export async function startHttpMcp(opts: {
  store: ProjectStore
  mode: McpMode
  token: string
  port: number
}): Promise<HttpMcpHandle> {
  const server = http.createServer((req, res) => {
    void (async () => {
      const auth = req.headers.authorization ?? ''
      if (auth !== `Bearer ${opts.token}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'unauthorized' }))
        return
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'method not allowed (stateless server: POST only)' }))
        return
      }
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      let body: unknown
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid JSON' }))
        return
      }
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      })
      const clientLabel = `http:${String(req.headers['x-archi-client'] ?? 'remote')}`
      const mcpServer = createArchiMcpServer({
        store: opts.store,
        mode: opts.mode,
        clientLabel
      })
      res.on('close', () => {
        void transport.close()
      })
      await mcpServer.connect(transport)
      await transport.handleRequest(req, res, body)
    })().catch((e) => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
      }
      res.end(JSON.stringify({ error: String((e as Error).message ?? e) }))
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port, '127.0.0.1', () => resolve())
  })

  return {
    port: opts.port,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  }
}

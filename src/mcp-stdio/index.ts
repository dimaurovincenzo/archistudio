import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ProjectStore } from '../main/store'
import { createArchiMcpServer, McpMode } from '../main/mcp/server'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined
}

/**
 * ArchiStudio MCP stdio entry point (plain Node, no Electron).
 *
 *   node out/mcp/index.js --project <project-dir> [--mode read-only|approval|write] [--client <label>]
 *
 * Add this to any MCP client (Cursor, Claude Desktop, ZCode…):
 *   { "command": "node", "args": ["<repo>/out/mcp/index.js", "--project", "<project-dir>"] }
 */
async function main(): Promise<void> {
  const project = arg('project') ?? process.env.ARCHI_PROJECT
  if (!project) {
    console.error('usage: archi-mcp --project <project-dir> [--mode read-only|approval|write]')
    process.exit(1)
  }
  const mode = (arg('mode') as McpMode | undefined) ?? 'approval'
  const store = await ProjectStore.open(project)
  const server = createArchiMcpServer({
    store,
    mode,
    clientLabel: arg('client') ?? 'stdio'
  })
  await server.connect(new StdioServerTransport())
  console.error(
    `[archistudio] MCP stdio ready — project "${store.meta.name}", mode: ${mode}, ${store.model.nodes.length} components`
  )
}

main().catch((e) => {
  console.error('[archistudio] fatal:', e)
  process.exit(1)
})

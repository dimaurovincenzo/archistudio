# MCP Server Reference

ArchiStudio exposes the open project to any Model Context Protocol client. One server, two transports, three security modes.

## Connecting

**stdio** (Cursor, Claude Desktop, ZCode…). The Settings dialog generates this with real paths:

```json
{
  "mcpServers": {
    "archistudio": {
      "command": "node",
      "args": [
        "/path/to/archistudio/out/mcp/index.js",
        "--project", "/path/to/project-folder",
        "--mode", "approval"
      ]
    }
  }
}
```

Build the bundle first (`npm run build` or `npm run build:mcp`). In the packaged app the bundle lives at `ArchiStudio.app/Contents/Resources/mcp/index.js`.

**HTTP** (optional, remote-capable): start it in Settings → MCP, then:

```json
{
  "mcpServers": {
    "archistudio-http": {
      "type": "http",
      "url": "http://127.0.0.1:8742/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

The HTTP endpoint is stateless (one server instance per request), bound to `127.0.0.1`, and requires the bearer token from Settings.

## Security modes

| Mode | Read tools | Direct writes | `propose_changes` | `apply_changes` |
|---|---|---|---|---|
| `read-only` | ✅ | ❌ | ❌ | ❌ |
| `approval` *(default)* | ✅ | ❌ | ✅ queued | ❌ (human approves in-app) |
| `write` | ✅ | ✅ + auto snapshot | ✅ queued | ✅ |

Notes:

- In `approval` mode, proposals are persisted to `<project>/.archi/proposals/<id>.json` and appear in the app (Explorer → *MCP Proposals* section) with Approve/Reject buttons. Approval converts the ops into a regular apply (with undo step + validation).
- In `write` mode, `apply_changes` applies a proposal created in the same session; every direct write takes an automatic pre-change snapshot in `versions/`.
- Every call — allowed or refused — is appended to `<project>/.archi/audit.jsonl` with the client label, tool name and outcome.

## Tools (18)

### Read

| Tool | Params | Returns |
|---|---|---|
| `get_project` | — | Name, description, counts, updatedAt |
| `get_architecture` | — | Full model: nodes, relations (with resolved source/target names), groups, artifact summaries |
| `get_node` | `node` (id or exact unique name) | Node detail + inbound/outbound relations |
| `search_nodes` | `query`, `type?` | Matching components (name/type/technology/tags/description) |
| `get_relationships` | `node?`, `type?` | Relations filtered by endpoint or type |
| `get_artifact` | `artifact` (id or title) | Full Markdown content + metadata |
| `search_artifacts` | `query?`, `category?` | Artifact summaries (title, category, linked nodes) |
| `validate_architecture` | — | Errors/warnings with codes and offending entities |

### Write (require `write` or `approval`)

| Tool | Params |
|---|---|
| `create_node` | `name` (required), `type?`, `category?`, `description?`, `technology?`, `responsibilities?`, `tags?`, `group?`, `position? {x,y}` |
| `update_node` | `node` (id/name), any of the create fields |
| `delete_node` | `node` — cascades to relations and artifact links |
| `create_relationship` | `source`, `target` (ids or names), `type?`, `direction?`, `description?`, `protocol?`, `payload?` |
| `update_relationship` | `id`, `type?`, `direction?`, `description?`, `protocol?`, `payload?` |
| `delete_relationship` | `id` |
| `create_artifact` | `title`, `category`, `content?`, `linkedNodes?` |
| `update_artifact` | `artifact` (id/title), `title?`, `content?`, `category?`, `linkedNodes?` |

Errors are returned as tool errors (`ERROR: …`), e.g. writes in read-only mode, unknown components, invalid operations.

### Proposal flow

| Tool | Params | Behaviour |
|---|---|---|
| `propose_changes` | `title`, `summary`, `ops[]` | Validates/sanitizes the ops (same sanitizer as the AI layer), queues the proposal, returns `proposalId` |
| `apply_changes` | `proposalId` | `write` mode only: applies the queued ops |

Supported ops in `propose_changes`: `create_node`, `update_node`, `delete_node`, `create_relation`, `update_relation`, `delete_relation`, `create_group`, `update_group`, `delete_group`, `create_artifact`, `update_artifact`, `delete_artifact`. Component references accept **ids or exact unique names**; references to nodes created earlier **in the same batch** are resolved at apply time.

Example:

```json
{
  "title": "Add Redis cache",
  "summary": "Cache layer between API and Worker",
  "ops": [
    { "op": "create_node", "node": { "name": "Redis", "type": "redis" } },
    { "op": "create_node", "node": { "name": "API", "type": "api" } },
    { "op": "create_relation", "relation": { "source": "API", "target": "Redis", "type": "db" } }
  ]
}
```

## Resources (5)

| URI | Content |
|---|---|
| `architecture://project` | Project metadata + entity counts |
| `architecture://nodes` | All components (full JSON) |
| `architecture://relationships` | All relations with resolved names |
| `architecture://artifacts` | Artifact index (id, title, category, linked nodes) |
| `architecture://decisions` | ADR-category artifacts |

Resources are read-only context: an agent can load the whole model without calling tools.

## Testing

`npm run test:mcp` spawns the stdio server as a real subprocess and asserts, end-to-end: initialize handshake, full tool/resource listing, writes persisted to disk, audit entries, automatic snapshots, name-based relation resolution, approval-mode refusal of direct writes, proposal persistence, read-only refusals. Requires `npm run build:mcp` first.

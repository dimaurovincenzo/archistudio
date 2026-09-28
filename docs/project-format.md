# Project Format

An ArchiStudio project is a **plain folder of files** — readable, diffable and versionable without the app. No proprietary blob.

## Layout

```
my-project/
├── project.json
├── architecture/
│   ├── nodes/<id>.json
│   ├── relations/<id>.json
│   └── groups/<id>.json
├── artifacts/<slug>--<id>.md
├── versions/<id>.json
└── .archi/
    ├── proposals/<id>.json
    └── audit.jsonl
```

Projects live by default in `~/Documents/ArchiStudio/<project-folder>` (configurable in Settings). Each project folder is a git repository (initialized on creation).

## `project.json`

```json
{
  "id": "my-project-a1b2c3",
  "name": "My Project",
  "description": "...",
  "createdAt": "2026-09-28T10:00:00.000Z",
  "updatedAt": "2026-09-28T12:00:00.000Z"
}
```

## Components — `architecture/nodes/<id>.json`

```json
{
  "id": "n_Xy12zK3m",
  "name": "API",
  "type": "nodejs",
  "category": "backend",
  "description": "Public REST API gateway.",
  "responsibilities": ["Expose endpoints", "Validate input"],
  "technology": "Node.js 22 + Express",
  "tags": ["gateway"],
  "properties": { "port": "3000", "instances": "2×" },
  "groupId": "g_abc123",
  "position": { "x": 500, "y": 380 },
  "createdAt": "...", "updatedAt": "..."
}
```

- `type` — a technology-catalog id (`src/shared/tech.ts`, 169 entries) or any custom string. It drives icon, color, label and the suggested category.
- `category` — architectural grouping: `frontend | backend | data | infrastructure | external | ai | generic`.
- `properties` — free key/value map; `host`, `port`, `instances`, `domain` are rendered on the canvas and in SVG exports.
- `position` — canvas coordinates (dagre auto-layout can recompute them).

## Relations — `architecture/relations/<id>.json`

```json
{
  "id": "r_Ab34cD5e",
  "sourceId": "n_Xy12zK3m",
  "targetId": "n_Uv90wX1y",
  "type": "rest",
  "direction": "one-way",
  "description": "Proxy of dynamic calls",
  "protocol": "HTTPS /v1",
  "payload": "",
  "metadata": {},
  "createdAt": "...", "updatedAt": "..."
}
```

Relation types: `http`, `rest`, `graphql`, `websocket`, `event`, `queue`, `db`, `auth`, `dependency`, `dataflow`, `component` (structural: a service → one of its internal sub-components). Custom types are allowed. `direction: "two-way"` renders double arrows.

## Groups — `architecture/groups/<id>.json`

```json
{ "id": "g_abc123", "name": "Servizi", "color": "#6366f1", "description": "" }
```

Nodes reference their group via `groupId`. On the canvas a group renders as a colored dashed box computed from the bounding box of its members.

## Artifacts — `artifacts/<slug>--<id>.md`

Markdown with YAML frontmatter:

```markdown
---
id: art_Qr56sT7u
title: "System Specification"
category: system
derived: template
nodeIds: ["n_Xy12zK3m"]
createdAt: "..."
updatedAt: "..."
---
# System Specification
...body...
```

`category`: `requirements | system | component | api | database | dataflow | adr | deployment`.
`derived`: `template` (deterministic generator) | `ai` | `mcp` | `manual`.

## Versions — `versions/<id>.json`

Full-model snapshots (JSON). Manual versions are also committed to the project's git repository with the chosen label; automatic snapshots (`"auto": true`, taken before AI/MCP changes and version restores) are file-only and never committed automatically.

## `.archi/` — internal state

- `proposals/<id>.json` — MCP proposals in `approval` mode, pending human review; `{ "status": "approved" | "rejected" }` after the decision (ops are cleared after approval/rejection).
- `audit.jsonl` — one JSON line per MCP call: timestamp, mode, client label, tool, outcome, args preview.

`.archi/` is git-ignored by the app.

## Versioning of the format

The format is currently unversioned-by-field (v1 implied). Structural changes will add a `formatVersion` field to `project.json` with migration logic in `ProjectStore`.

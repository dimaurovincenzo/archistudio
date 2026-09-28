# Internal Architecture

How ArchiStudio is built: processes, layers, and the single mutation funnel that keeps UI, AI and MCP consistent.

## Processes

```
Electron main process (Node)
├── IPC handlers (src/main/ipc.ts)      ← every mutation from the UI
├── ProjectStore (src/main/store.ts)    ← persistence to disk (JSON + Markdown)
├── applyOps (src/main/ops.ts)          ← THE mutation funnel
├── validation (src/main/validation.ts)
├── versioning + git (src/main/versioning.ts)
├── AI layer (src/main/ai/)             ← OpenAI-compatible, streaming
├── MCP server (src/main/mcp/)          ← stdio + stateless HTTP
├── demo seed (src/main/demo.ts)
└── window-state, settings (safeStorage/Keychain)

Preload bridge (src/preload/index.ts)   ← contextBridge "archi" API, typed

Renderer (React 19)
├── store (src/renderer/src/store.ts)   ← zustand, single source of UI state
├── Canvas (React Flow) / Explorer / Inspector / ComponentDetailView
├── ChatPanel (AI Architect)            ← streaming via IPC events
├── ArtifactView (markdown, 3 modes)    ├── HelpCenter / Onboarding / CommandPalette
└── icons.tsx                           ← 44 family glyphs from the tech catalog
```

## The mutation funnel: `applyOps`

**Every** model change — from the UI, the AI architect, or an MCP client — is expressed as a batch of `Op` objects and applied through one function: `applyOps(model, ops)` in `src/main/ops.ts`.

```
UI click ──► IPC ops:apply ──┐
AI proposal ────────────────►├── applyOps() ──► persist(touched) ──► file watcher ──► renderer refresh
MCP tool ────────────────────┘        │
                                      └── all-or-nothing: any failed op rolls back the whole batch
```

Properties of the funnel:

- **Atomic**: the model is deep-cloned first; a failing op aborts the batch with the original model untouched.
- **Name resolution at apply time**: relation endpoints and artifact links accept ids *or* unique component names. Resolution happens against the model *as mutated so far in the same batch* — so an AI proposal can create a node and connect it in one batch.
- **Referential integrity by construction**: deleting a node cascades to its relations and artifact links; artifact `nodeIds` referencing missing components can only appear through external file edits (the validator flags them as errors).
- **Explicit ids supported** on `create_node` / `create_group` (used by copy-paste to pre-link clones).

Supported ops: `create_node`, `update_node`, `delete_node`, `create_relation`, `update_relation`, `delete_relation`, `create_group`, `update_group`, `delete_group`, `create_artifact`, `update_artifact`, `delete_artifact`, `set_position`.

## Undo/redo

The main process keeps a per-project stack of up to 60 model snapshots (`src/main/ipc.ts`, `undoStacks`). Every successful `ops:apply` pushes the pre-change model; undo/redo pops and re-applies. Because AI and MCP changes go through the same funnel, **⌘Z covers everything**, including external proposals and version restores.

## Persistence (`ProjectStore`)

One file per entity, atomic writes (`.tmp-<pid>` + rename):

```
<project>/
├── project.json                    # metadata
├── architecture/nodes/<id>.json    # one file per component
├── architecture/relations/<id>.json
├── architecture/groups/<id>.json
├── artifacts/<slug>--<id>.md       # Markdown + YAML frontmatter
├── versions/<id>.json              # full-model snapshots
└── .archi/
    ├── proposals/<id>.json         # queued MCP proposals (approval mode)
    └── audit.jsonl                 # one line per MCP call
```

`persist(touched?)` writes only the entities modified by the operation (the touched set comes back from `applyOps`), so a single node drag rewrites one file, not the whole project. An artifact filename cache (`artFileCache`) avoids re-scanning the artifacts folder on every save.

A `fs.watch` on the project directory detects external modifications (e.g. an MCP server running in another process) and reloads the model into the UI, with an 800 ms suppression window right after our own writes.

## Technology catalog (`src/shared/tech.ts`)

169 technologies × 44 visual families. Each entry maps a lowercase `type` id to `{ label, family, category, color }`. Consumers:

- **Canvas/Explorer/minimap/SVG export** — icon (`FamilyIcons` glyph per family), tile color, label
- **`applyOps`** — `guessCategory(type)` seeds the architectural category of new nodes
- **AI prompt** — the agent is instructed to use catalog ids as component types
- Unknown types degrade gracefully (`known: false`, generic glyph) and are fully supported

## AI layer (`src/main/ai/`)

- `client.ts` — OpenAI-compatible chat, non-streaming and **streaming** (SSE). Pure, testable helpers: `parseSSEBuffer` (line-framing) and `accumulateToolCallDeltas` (re-assembles fragmented tool calls).
- `tools.ts` — the `propose_architecture_changes` tool schema + `sanitizeOps`: raw AI/MCP ops are validated, name-references resolved, unknown ops dropped, node references to *not-yet-created* nodes passed through (resolved at `applyOps` time).
- `agent.ts` — system rules (use the tool for any model change, reference by exact name, reply in the user's language), streaming with automatic non-streaming fallback.

Proposals never touch the model directly: the renderer shows an approve/reject card, and approval converts the ops into a regular `applyOps` call (which creates an undo step).

## MCP server (`src/main/mcp/`)

- `server.ts` — 18 tools + 5 resources built on the official TypeScript SDK. The **same** `ProjectStore` and `applyOps` as the UI. Security modes gate writes: `read-only` refuses everything, `approval` allows only `propose_changes` (queued to `.archi/proposals/` and surfaced in the app), `write` applies directly after an automatic snapshot.
- `http.ts` — stateless streamable-HTTP transport bound to 127.0.0.1 with bearer-token auth (one fresh server per request; proposals tracked in a module-level registry).
- `mcp-stdio/` — standalone Node entry point (`out/mcp/index.js`, bundled with esbuild, no Electron) for Cursor/Claude/ZCode configs.
- Every call is audited to `.archi/audit.jsonl` (client label, tool, outcome).

## Renderer conventions (hard-won)

- **Never write React Flow's `selected` flag from our code.** RF v12 owns selection in its internal store; re-syncing the flag causes an update loop (React error #185). Visual selection travels in node `data` (`sel`, `near`) and is patched by a light effect — the base node list is rebuilt only when the model changes, with identity-preserving merge so untouched nodes keep their object references (no flicker at drag end).
- **Selection echo guard**: programmatic selection updates node data → RF re-emits an empty selection → `onSelectionChange` ignores empty events within 150 ms of a programmatic `select()` (`getLastSelectTs()`).
- **Level of Detail** via `LodController` (zoom-driven CSS classes on the canvas wrapper, no React re-render) + `onlyRenderVisibleElements` (viewport culling).
- Store state read inside effects must be re-read after awaits: `getState()` returns snapshots.

See [development.md](development.md) for testing and debugging workflows.

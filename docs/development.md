# Development Guide

Setup, conventions, testing and debugging workflows for contributing to ArchiStudio.

## Requirements

- Node.js ≥ 22, npm ≥ 10
- macOS recommended (Keychain encryption, vibrancy); Windows/Linux run without the macOS-only polish
- Git

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development with HMR (electron-vite: main + preload + renderer) |
| `npm test` | Unit tests (vitest) |
| `npm run test:mcp` | MCP stdio e2e test (needs `npm run build:mcp`) |
| `npm run build` | Production build: main + preload + renderer (+ sourcemaps) + MCP bundle |
| `npm run build:mcp` | MCP stdio bundle only (esbuild → `out/mcp/index.js`) |
| `npm start` | Run the built app |
| `npm run dist` | macOS .app/.zip via electron-builder → `release/` |
| `npx tsc --noEmit` | Typecheck |

## Code layout

```
src/
├── shared/          # types.ts (domain + UI contracts), tech.ts (catalog), ids.ts
├── main/            # Electron main process (Node)
│   ├── store.ts     # ProjectStore: persistence
│   ├── ops.ts       # applyOps: THE mutation funnel
│   ├── ipc.ts       # IPC handlers incl. undo/redo, ctx menus, MCP HTTP control
│   ├── validation.ts, versioning.ts, templates.ts, export-svg.ts
│   ├── ai/          # client.ts (SSE), tools.ts (sanitize), agent.ts (rules)
│   └── mcp/         # server.ts, http.ts, catalog.ts
├── preload/         # contextBridge API (typed, consumed as window.archi)
├── mcp-stdio/       # standalone MCP entry (bundled separately)
└── renderer/src/
    ├── store.ts     # zustand: all UI state and actions
    ├── components/  # Canvas, Explorer, Inspector, ChatPanel, …
    ├── icons.tsx    # family glyphs + colors
    └── utils/       # paste.ts, align.ts (pure, unit-tested)
tests/               # vitest: ops, validation, store, tech, paste, align, stream-parser
scripts/             # make-icon.js, test-mcp.mjs
```

## Conventions

1. **All model changes go through `applyOps`.** UI actions, AI proposals and MCP tools must never mutate the model directly. If you need a new mutation, add an `Op` kind to `ops.ts` (atomic, with validation) and route to it.
2. **Never write React Flow's `selected`/`checked` flags from our code.** RF v12 owns selection internally; re-syncing it from props causes an infinite update loop (React #185). Visual selection lives in node `data` (`sel`, `near`) applied by the light patch effect, with identity-preserving merge in the base effect (untouched nodes keep their object references).
3. **Guard against the selection echo.** Programmatic `select()` sets a timestamp; `onSelectionChange` ignores empty selection events within 150 ms (RF re-emits an empty selection when we replace node objects).
4. **`getState()` returns snapshots** — after any `await`, re-read state (`useStore.getState()`) instead of holding a stale reference (smoke tests bite on this).
5. **Effects with hook calls in deps**: the dimming effect reads `useStore((s) => s.editingNodeId)` inline in its dependency array. It works, but prefer subscribing above the effect if you refactor.
6. **No emoji in the UI** — the icon system is hand-drawn SVG glyphs per technology family (`icons.tsx`).
7. **UI language is Italian**; MCP tool descriptions and the open-source README are English.

## Testing

- Unit tests (vitest) cover the domain: op atomicity, name resolution, validation rules, store roundtrip (files on disk), versioning, template generation, tech catalog integrity, paste/align helpers, SSE parsing.
- `scripts/test-mcp.mjs` spawns the built MCP stdio server as a subprocess and runs a full behavioral suite (handshake, tools, security modes, persistence, audit). It requires `npm run build:mcp` first.
- The app supports `--smoke`: launches, seeds/opens a project, screenshots to `/tmp/archistudio-smoke*.png` (canvas, detail, onboarding, help, settings, panels-collapsed, selection, expansion) and runs an interactive step sequence (chat-safe selection, save, artifacts, versions, copy/paste, undo/redo, panel toggles, subgraph). `--smoke-project=<name prefix>` targets an existing project. Smoke runs use a dedicated userData (`/tmp/archistudio-smoke-userdata`) so they never collide with a running app.

## Debugging

- **Renderer errors are logged** to `~/Library/Application Support/ArchiStudio/archistudio.log` (main-process `console-message` hook) — check it first when something breaks.
- **React ErrorBoundary** stores the last render error (message + component stack) in `window.__lastBoundary`.
- **CDP**: run `electron . --remote-debugging-port=9222` (or any port) to inspect the renderer; with `ARCHI_USER_DATA=/tmp/some-dir` you get an isolated instance you can leave running while the real app is open (single-instance lock is per-userData). Useful one-liners: read `window.__archi.getState()`, drive actions, capture console errors.
- **Crash log** location: `~/Library/Application Support/ArchiStudio/archistudio.log` (uncaught exceptions also show a dialog).
- Dev and packaged app share the same userData on macOS (case-insensitive names): close the packaged app before running dev, or use `ARCHI_USER_DATA`.

## Release

`npm run dist` builds the signed-off macOS zip with the MCP bundle in `extraResources`. The MCP path inside the app is `ArchiStudio.app/Contents/Resources/mcp/index.js` (`app.isPackaged` branches resolve this automatically everywhere).

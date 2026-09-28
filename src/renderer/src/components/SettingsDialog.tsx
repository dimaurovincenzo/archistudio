import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { AppSettings } from '../../../shared/types'
import { api } from '../api'

const PRESETS: { name: string; baseUrl: string; model: string; needsKey: boolean }[] = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  { name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1', needsKey: false },
  { name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', model: 'local-model', needsKey: false },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4', needsKey: true }
]

export function SettingsDialog() {
  const settings = useStore((s) => s.settings)
  const saveSettings = useStore((s) => s.saveSettings)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const data = useStore((s) => s.data)
  const mcp = useStore((s) => s.mcp)
  const [draft, setDraft] = useState<AppSettings | null>(settings)
  const [httpRunning, setHttpRunning] = useState(false)
  const [catalog, setCatalog] = useState<{ tools: { name: string; description: string; write?: boolean }[]; resources: { uri: string; description: string }[] } | null>(null)

  useEffect(() => {
    api.mcp.catalog().then(setCatalog).catch(() => {})
  }, [])

  const copyText = (text: string, what: string) => {
    void navigator.clipboard.writeText(text)
    useStore.getState().showToast(`${what} copiato`)
  }
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    api.app.info().then((i) => setAppVersion(i.version))
  }, [])

  useEffect(() => {
    setDraft(settings)
    api.mcp.status().then((s) => setHttpRunning(s.httpRunning))
  }, [settings])

  if (!draft) return null

  const set = (patch: Partial<AppSettings>) => setDraft({ ...draft, ...patch })

  const projectDir = mcp?.projectDir || data?.meta.path || '<apri un progetto>'
  const stdioSnippet = `{
  "mcpServers": {
    "archistudio": {
      "command": "node",
      "args": [
        "${mcp?.stdioScript ?? '<percorso bundle MCP>'}",
        "--project", "${projectDir}",
        "--mode", "${draft.mcp.mode}"
      ]
    }
  }
}`
  const httpSnippet = `{
  "mcpServers": {
    "archistudio-http": {
      "type": "http",
      "url": "${mcp?.httpUrl ?? `http://127.0.0.1:${draft.mcp.httpPort}/mcp`}",
      "headers": { "Authorization": "Bearer ${draft.mcp.token}" }
    }
  }
}`

  return (
    <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Impostazioni</h3>
        <div className="modal-sub">Salvate localmente nella cartella dati dell'app. Mai sincronizzate altrove.</div>

        <div className="section-title">Archiviazione</div>
        <label>Cartella progetti</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={draft.projectsRoot} onChange={(e) => set({ projectsRoot: e.target.value })} />
          <button
            className="small"
            onClick={async () => {
              const dir = await api.app.chooseDir()
              if (dir) set({ projectsRoot: dir })
            }}
          >
            Scegli…
          </button>
        </div>

        <div className="section-title">Provider AI (OpenAI-compatible)</div>
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              className="small"
              onClick={() => set({ ai: { ...draft.ai, baseUrl: p.baseUrl, model: p.model } })}
            >
              {p.name}
            </button>
          ))}
        </div>
        <label>Base URL</label>
        <input value={draft.ai.baseUrl} onChange={(e) => set({ ai: { ...draft.ai, baseUrl: e.target.value } })} />
        <div className="field-row">
          <div>
            <label>API key (vuota per i modelli locali)</label>
            <input
              type="password"
              value={draft.ai.apiKey}
              onChange={(e) => set({ ai: { ...draft.ai, apiKey: e.target.value } })}
              placeholder={draft.ai.apiKeyStored ? 'salvata e criptata nel portachiavi — digita per sostituirla' : 'sk-…'}
            />
          </div>
          <div>
            <label>Modello</label>
            <input value={draft.ai.model} onChange={(e) => set({ ai: { ...draft.ai, model: e.target.value } })} />
          </div>
        </div>

        <div className="section-title">Server MCP — esponi l'architettura ad agenti esterni</div>
        <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6, margin: '4px 0 8px' }}>
          I client AI (Cursor, Claude Desktop, ZCode…) vedono il progetto aperto e possono leggerlo o
          modificarlo secondo la modalità scelta. Tutto è tracciato in{' '}
          <code className="kbd">{mcp?.projectDir ? `${mcp.projectDir}/.archi/audit.jsonl` : '.archi/audit.jsonl'}</code>.
        </p>
        <div className="field-row">
          <div>
            <label>Modalità</label>
            <select
              value={draft.mcp.mode}
              onChange={(e) => set({ mcp: { ...draft.mcp, mode: e.target.value as AppSettings['mcp']['mode'] } })}
            >
              <option value="approval">approval — le scritture esterne richiedono la tua approvazione nell'app</option>
              <option value="write">write — i client esterni applicano direttamente (con snapshot automatico)</option>
              <option value="read-only">read-only — i client esterni possono solo leggere</option>
            </select>
          </div>
          <div>
            <label>Porta HTTP (locale)</label>
            <input
              type="number"
              value={draft.mcp.httpPort}
              onChange={(e) => set({ mcp: { ...draft.mcp, httpPort: Number(e.target.value) || 8742 } })}
            />
          </div>
        </div>

        <label>1 · Connessione stdio — Cursor, Claude Desktop, ZCode</label>
        <p style={{ color: 'var(--muted)', fontSize: 11.5, margin: '0 0 6px' }}>
          Percorsi già compilati per questa installazione. Richiede Node.js nel PATH
          {!mcp?.packaged && ' — in sviluppo esegui prima npm run build:mcp'}.
        </p>
        <div className="snippet-box">{stdioSnippet}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="small" onClick={() => copyText(stdioSnippet, 'Configurazione stdio')}>Copia configurazione JSON</button>
          <button className="small" onClick={() => copyText(`node "${mcp?.stdioScript ?? ''}" --project "${mcp?.projectDir ?? ''}" --mode ${draft.mcp.mode}`, 'Comando MCP')}>Copia comando</button>
        </div>

        <label>2 · Endpoint HTTP locale (opzionale)</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="small"
            onClick={async () => {
              await saveSettings(draft)
              const res = httpRunning ? await api.mcp.httpStop() : await api.mcp.httpStart()
              if (res.ok) setHttpRunning(!httpRunning)
            }}
          >
            {httpRunning ? 'Ferma endpoint HTTP' : 'Avvia endpoint HTTP'}
          </button>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>
            {httpRunning ? `attivo su ${mcp?.httpUrl ?? `http://127.0.0.1:${draft.mcp.httpPort}/mcp`}` : 'fermo'}
          </span>
        </div>
        <label style={{ marginTop: 8 }}>URL e token</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="token-box" style={{ flex: 1 }}>{mcp?.httpUrl ?? `http://127.0.0.1:${draft.mcp.httpPort}/mcp`}</div>
          <button className="small" onClick={() => copyText(mcp?.httpUrl ?? '', 'URL endpoint')}>Copia URL</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
          <div className="token-box" style={{ flex: 1 }}>{draft.mcp.token}</div>
          <button
            className="small"
            title="Genera un nuovo token (invalida il precedente)"
            onClick={() =>
              set({
                mcp: {
                  ...draft.mcp,
                  token: Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
                }
              })
            }
          >
            Rigenera
          </button>
          <button className="small" onClick={() => copyText(draft.mcp.token, 'Token')}>Copia</button>
        </div>
        <div className="snippet-box" style={{ marginTop: 8 }}>{httpSnippet}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="small" onClick={() => copyText(httpSnippet, 'Configurazione HTTP')}>Copia configurazione HTTP</button>
        </div>

        <label>3 · Cosa espone il server</label>
        {catalog && (
          <details className="mcp-catalog">
            <summary>{catalog.tools.length} strumenti e {catalog.resources.length} risorse</summary>
            <div className="mcp-catalog-body">
              {catalog.tools.map((t) => (
                <div key={t.name} className="mcp-tool-row">
                  <code>{t.name}</code>
                  <span>{t.description}</span>
                  {t.write && <span className="badge" title="Richiede modalità write o approval">write</span>}
                </div>
              ))}
              {catalog.resources.map((r) => (
                <div key={r.uri} className="mcp-tool-row">
                  <code>{r.uri}</code>
                  <span>{r.description}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="small"
            onClick={() => {
              setSettingsOpen(false)
              useStore.getState().reopenOnboarding()
            }}
          >
            Ripeti guida iniziale
          </button>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>ArchiStudio v{appVersion}</span>
        </div>
        <div className="modal-actions">
          <button onClick={() => setSettingsOpen(false)}>Annulla</button>
          <button
            className="primary"
            onClick={() => {
              void saveSettings(draft)
              setSettingsOpen(false)
            }}
          >
            Salva impostazioni
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useStore } from '../store'

const Kbd = ({ children }: { children: string }) => <code className="kbd">{children}</code>

const TABS: { id: string; label: string }[] = [
  { id: 'guide', label: 'Guida rapida' },
  { id: 'shortcuts', label: 'Scorciatoie' },
  { id: 'ai', label: 'Architetto AI' },
  { id: 'mcp', label: 'MCP' },
  { id: 'faq', label: 'FAQ' }
]

function Guide() {
  return (
    <div className="help-tab">
      <h4>L'idea in una frase</h4>
      <p>
        L'<strong>architettura è la source of truth</strong>: la disegni sulla canvas, l'AI ti aiuta a
        evolverla, le specifiche sono <strong>derivate</strong> dal modello (mai il contrario) e il
        server MCP la rende accessibile agli agenti AI.
      </p>
      <h4>Il flusso tipico</h4>
      <ol className="help-ol">
        <li><strong>Canvas</strong> — crea i componenti (doppio click / tasto destro), scegli la tecnologia dal catalogo e collegali trascinando dai punti laterali.</li>
        <li><strong>Gruppi</strong> — organizza visivamente: il riquadro segue i nodi.</li>
        <li><strong>Architetto AI</strong> — chiedi modifiche in chat: arrivano come proposta con Approva/Rifiuta, sempre sotto il tuo controllo.</li>
        <li><strong>Artefatti</strong> — genera specifiche (componente, API, ADR…) dal modello e modificali liberamente; «Regenerate» le riallinea al grafo.</li>
        <li><strong>Validazione</strong> — controlli strutturali: riferimenti rotti, cicli, nodi orfani, responsabilità mancanti.</li>
        <li><strong>Versioni</strong> — ⌘S crea una versione (commit git); prima di ogni modifica AI/MCP viene preso uno snapshot automatico.</li>
        <li><strong>MCP</strong> — collega Cursor/Claude: l'agente legge l'architettura e propone modifiche che approvi nell'app.</li>
      </ol>
      <h4>Dove finiscono i dati</h4>
      <p>
        Progetti in <code className="kbd">~/Documents/ArchiStudio/</code> (modificabile): file JSON per
        componenti e relazioni, markdown con frontmatter per le specifiche, snapshot in <code className="kbd">versions/</code>, audit MCP in{' '}
        <code className="kbd">.archi/audit.jsonl</code>. Tutto leggibile senza l'app e git-friendly.
      </p>
    </div>
  )
}

const SHORTCUTS: [string, string][] = [
  ['⌘K', 'Palette comandi — tutte le azioni dell’app'],
  ['⌘N', 'Nuovo progetto'],
  ['⌘S', 'Salva versione (commit git)'],
  ['⌘E / ⌘⇧E', 'Esporta JSON / Mermaid'],
  ['⌘Z / ⌘⇧Z', 'Annulla / Ripeti (incluso AI e MCP)'],
  ['⌘F', 'Cerca nel progetto'],
  ['⌘/', 'Centro assistenza'],
  ['⌘,', 'Impostazioni'],
  ['⌘1 / ⌘2 / ⌘J', 'Mostra/nascondi Explorer, Inspector, Chat'],
  ['⌘L', 'Layout automatico della canvas'],
  ['⌘8 / ⌘+ / ⌘- / ⌘0', 'Adatta vista / zoom'],
  ['⌘U', 'Valida architettura'],
  ['⌘4', 'Versioni'],
  ['⌘⇧C / ⌘⇧X / ⌘⇧V', 'Copia / taglia / incolla componenti'],
  ['⌘D', 'Duplica componente (dal tasto destro)'],
  ['Backspace', 'Elimina la selezione (annullabile con ⌘Z)'],
  ['Invio', 'Rinomina il componente selezionato direttamente sulla canvas (come Figma)'],
  ['Shift+1 / Shift+2', 'Adatta tutto alla vista / zoom sulla selezione (standard Figma)'],
  ['Spazio + trascina', 'Pan della canvas anche partendo da un nodo'],
  ['E', 'Espandi il sotto-grafo del componente selezionato (anche dentro un’espansione, per saltare di modulo in modulo)'],
  ['Esc', 'Esci dal sotto-grafo e torna al grafo completo'],
  ['Doppio click', 'Dettaglio del componente / nuovo componente sulla canvas'],
  ['Tasto destro', 'Menu contestuale: canvas, nodi, relazioni, explorer'],
  ['Due dita / pinch', 'Pan / zoom della canvas'],
  ['⌘-click', 'Multi-selezione; trascina a vuoto per la selezione a rettangolo']
]

function Shortcuts() {
  return (
    <div className="help-tab">
      <table className="detail-table">
        <thead>
          <tr><th>Scorciatoia</th><th>Azione</th></tr>
        </thead>
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k}><td><Kbd>{k}</Kbd></td><td>{d}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AI() {
  return (
    <div className="help-tab">
      <h4>Configurazione</h4>
      <p>
        Impostazioni → <strong>Provider AI</strong>: qualsiasi endpoint OpenAI-compatible. Presi pronti
        per OpenAI, Ollama (locale), LM Studio e OpenRouter. La chiave è <strong>cifrata nel
        portachiavi</strong> di macOS e non viene mai rimandata all'interfaccia.
      </p>
      <h4>Come lavora l'Architetto</h4>
      <ul className="help-ul">
        <li>Il <strong>contesto</strong> è la selezione corrente: nodo + collegamenti + artefatti collegati. Con «includi sempre l'intero progetto» usa tutto il modello.</li>
        <li>Le modifiche arrivano come <strong>proposta</strong>: elenco operativo (componenti, relazioni, artefatti) con Approva/Rifiuta. Nulla si applica senza di te.</li>
        <li>Prima di ogni applicazione viene preso uno <strong>snapshot automatico</strong>: ⌘Z e le Versioni ti coprono sempre.</li>
        <li>Chiedi anche analisi («questo servizio è troppo accoppiato?») e documenti («genera la specifica API di X»).</li>
      </ul>
      <h4>Consigli</h4>
      <ul className="help-ul">
        <li>Nomina i componenti in modo univoco: l'AI li referenzia per nome.</li>
        <li>Con Ollama in locale servono modelli che gestiscono bene il function calling (es. llama3.1+).</li>
        <li>Se una proposta è sbagliata: Rifiuta e riformula, oppure Approva e ⌘Z.</li>
      </ul>
    </div>
  )
}

function MCP() {
  return (
    <div className="help-tab">
      <h4>Cosa abilita</h4>
      <p>
        18 strumenti e 5 risorse: i client AI possono leggere l'architettura, cercare, creare/modificare
        componenti e relazioni, generare artefatti e validare — usando la stessa logica dell'app.
      </p>
      <h4>Collegare Cursor / Claude Desktop</h4>
      <p>
        Impostazioni → MCP: copia lo snippet <code className="kbd">stdio</code> (già compilato col
        percorso del progetto). L'app pacchettizzata espone il bundle qui:{' '}
        <code className="kbd">ArchiStudio.app/Contents/Resources/mcp/index.js</code>.
      </p>
      <h4>Modalità di sicurezza</h4>
      <table className="detail-table">
        <thead><tr><th>Modalità</th><th>Comportamento</th></tr></thead>
        <tbody>
          <tr><td>read-only</td><td>solo lettura, nessuna scrittura</td></tr>
          <tr><td><strong>approval</strong> (predefinita)</td><td>le modifiche esterne diventano proposte: le approvi nell'app (Explorer → Proposte MCP)</td></tr>
          <tr><td>write</td><td>applicazione diretta, con snapshot automatico e audit</td></tr>
        </tbody>
      </table>
      <h4>Tracciabilità</h4>
      <p>
        Ogni chiamata è registrata in <code className="kbd">.archi/audit.jsonl</code> (client, strumento,
        esito). L'endpoint HTTP locale (opzionale) richiede bearer token ed è vincolato a 127.0.0.1.
      </p>
    </div>
  )
}

const FAQ: [string, string][] = [
  ['Perché alcuni nodi sono attenuati?', 'Con un componente selezionato vengono attenuati quelli NON collegati direttamente: è l’evidenziazione del vicinato. Deseleziona (click sulla canvas) per tornare alla norma.'],
  ['Come collego due componenti?', 'Trascina dal punto laterale di un nodo (appare al passaggio del mouse) verso l’altro. Poi tasto destro sulla freccia per cambiare tipo/protocollo.'],
  ['Come cancello un componente?', 'Backspace sulla selezione, tasto destro → Elimina, o dal distaccato a destra. ⌘Z annulla sempre.'],
  ['Dove sono i miei progetti?', '~/Documents/ArchiStudio/ per predefinita. Ogni progetto è una cartella: project.json, architecture/, artifacts/, versions/.'],
  ['Cosa sono gli snapshot “auto”?', 'Versioni di sicurezza prese prima di ogni modifica AI/MCP e prima di un ripristino. Non inquinano la cronologia manuale.'],
  ['Come apro il dettaglio di un componente?', 'Doppio click sul nodo, doppio click nell’explorer, tasto destro → «Apri vista dettaglio», o l’icona nell’Inspector.'],
  ['Posso usare un modello AI locale?', 'Sì: Impostazioni → preset «Ollama (local)» o «LM Studio», senza API key. Il campo resta vuoto per i modelli locali.'],
  ['L’app non si avvia (istanza già attiva)?', 'ArchiStudio è single-instance: se un’altra copia è aperta, quello nuovo porta in primo piano la finestra esistente.'],
  ['Come esporto il diagramma?', '⌘E per JSON (riutilizzabile), ⌘⇧E per Mermaid (incollabile in GitHub/Notion), o tasto destro sulla canvas.']
]

function FAQView() {
  return (
    <div className="help-tab">
      {FAQ.map(([q, a]) => (
        <div key={q} className="help-faq">
          <div className="help-q">{q}</div>
          <div className="help-a">{a}</div>
        </div>
      ))}
    </div>
  )
}

export function HelpCenter() {
  const help = useStore((s) => s.help)
  const closeHelp = useStore((s) => s.closeHelp)
  const [tab, setTab] = useState('guide')

  useEffect(() => {
    if (help?.open) setTab(help.tab || 'guide')
  }, [help?.open, help?.tab])

  if (!help?.open) return null

  return (
    <div className="modal-overlay" onClick={closeHelp}>
      <div className="modal help-center" onClick={(e) => e.stopPropagation()}>
        <div className="help-head">
          <h3>Centro assistenza</h3>
          <div className="help-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`small ${tab === t.id ? 'primary' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="help-body">
          {tab === 'guide' && <Guide />}
          {tab === 'shortcuts' && <Shortcuts />}
          {tab === 'ai' && <AI />}
          {tab === 'mcp' && <MCP />}
          {tab === 'faq' && <FAQView />}
        </div>
        <div className="modal-actions">
          <span style={{ flex: 1, color: 'var(--faint)', fontSize: 11, alignSelf: 'center' }}>
            Ripeti il tour: Aiuto → Guida iniziale
          </span>
          <button className="primary" onClick={closeHelp}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}

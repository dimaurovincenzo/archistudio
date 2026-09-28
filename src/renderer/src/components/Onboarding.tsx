import { useState } from 'react'
import { useStore } from '../store'
import { AppLogo, nodeIcon, FamilyIcons } from '../icons'
import { GroupIcon, PlussIcon } from './toolbarIcons'

const Kbd = ({ children }: { children: string }) => <code className="kbd">{children}</code>

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8 16 16 8" />
  </svg>
)

function Bullets({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <ul className="ob-list">
      {items.map(([icon, text], i) => (
        <li key={i}>
          <span className="ob-bullet">{icon}</span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}

export function Onboarding() {
  const open = useStore((s) => s.onboardingOpen)
  const complete = useStore((s) => s.completeOnboarding)
  const [idx, setIdx] = useState(0)

  if (!open) return null

  const finish = () => void complete()

  const createProject = async () => {
    const name = await useStore.getState().requestInput('Nome del primo progetto:', 'Il mio sistema')
    if (name?.trim()) {
      await useStore.getState().createProject(name.trim(), '')
      finish()
    }
  }

  const loadDemo = async () => {
    await useStore.getState().openDemo()
    finish()
  }

  const openSettings = () => {
    finish()
    useStore.getState().setSettingsOpen(true)
  }

  const steps: { title: string; body: React.ReactNode; actions?: { label: string; primary?: boolean; run: () => void }[] }[] = [
    {
      title: 'Benvenuto in ArchiStudio',
      body: (
        <div>
          <p className="ob-p">
            Progetti l'architettura del software <strong>prima del codice</strong>: un modello visuale
            che è la <strong>source of truth</strong>, l'AI che collabora, e un server MCP che rende
            l'architettura leggibile dagli agenti (Cursor, Claude…).
          </p>
          <Bullets
            items={[
              [<span key="a" className="ob-ic" style={{ color: '#22d3ee' }}>{nodeIcon('web-app')}</span>, 'Canvas: componenti, collegamenti e gruppi — tutto salvato su disco in file aperti'],
              [<span key="b" className="ob-ic" style={{ color: '#ec4899' }}>{nodeIcon('ai-service')}</span>, 'Architetto AI: proposta → revisione → approvazione, nessuna modifica senza il tuo controllo'],
              [<span key="c" className="ob-ic" style={{ color: '#34d399' }}>{nodeIcon('external-api')}</span>, 'MCP: lettura e scrittura dell’architettura da client esterni, con audit log'],
            ]}
          />
          <p className="ob-p ob-muted">Tre minuti e sei operativo. Puoi ripetere questa guida da Aiuto → Guida iniziale.</p>
        </div>
      )
    },
    {
      title: 'Il tuo primo progetto',
      body: (
        <div>
          <p className="ob-p">Un progetto è una cartella di file JSON e markdown, aperta e versionabile con git.</p>
          <Bullets
            items={[
              [<span key="a" className="ob-ic">{nodeIcon('api')}</span>, 'Ogni componente è un file; ogni specifica è un markdown leggibile senza l’app'],
              [<span key="b" className="ob-ic">{nodeIcon('cron')}</span>, 'Salvataggio automatico continuo + versioni manuali (⌘S) che diventano commit git'],
              [<span key="c" className="ob-ic">{nodeIcon('storage')}</span>, 'Posizione predefinita: ~/Documents/ArchiStudio — cambiala quando vuoi nelle Impostazioni'],
            ]}
          />
        </div>
      ),
      actions: [
        { label: 'Crea progetto…', primary: true, run: () => void createProject() },
        { label: 'Carica la demo', run: () => void loadDemo() }
      ]
    },
    {
      title: 'La canvas',
      body: (
        <div>
          <p className="ob-p">Tutto parte da qui: la bacheca dei componenti del tuo sistema.</p>
          <Bullets
            items={[
              [<span key="a" className="ob-ic" style={{ color: '#22d3ee' }}><PlussIcon /></span>, <span key="at"><strong>Creare</strong> — doppio click sulla canvas, tasto destro → «Aggiungi componente», o ⌘K</span>],
              [<span key="b" className="ob-ic" style={{ color: '#34d399' }}><LinkIcon /></span>, <span key="bt"><strong>Collegare</strong> — trascina dal punto laterale di un nodo verso un altro; il tipo di relazione si cambia dal tasto destro</span>],
              [<span key="c" className="ob-ic" style={{ color: '#fbbf24' }}>{FamilyIcons.logs}</span>, <span key="ct"><strong>Dettagli</strong> — doppio click su un nodo apre la vista dettaglio completa (interfacce, proprietà, artefatti)</span>],
              [<span key="d" className="ob-ic" style={{ color: '#818cf8' }}>{FamilyIcons.language}</span>, <span key="dt"><strong>Tecnologie</strong> — il campo Tipo nel pannello a destra apre il catalogo: 169 tecnologie con icona e colore propri</span>],
              [<span key="e" className="ob-ic" style={{ color: '#a78bfa' }}><GroupIcon /></span>, <span key="et"><strong>Gruppi</strong> — raggruppa i nodi: sulla canvas appare un riquadro colorato che li segue</span>]
            ]}
          />
        </div>
      )
    },
    {
      title: "L'Architetto AI",
      body: (
        <div>
          <p className="ob-p">
            La chat in basso parla con il tuo modello: conosce la <strong>selezione corrente</strong>
            {' '}(nodo + collegamenti + artefatti) e propone modifiche strutturate che{' '}
            <strong>approvi tu</strong>.
          </p>
          <Bullets
            items={[
              [<span key="a" className="ob-ic" style={{ color: '#818cf8' }}>{FamilyIcons.server}</span>, <span key="at"><strong>Configura</strong> — Impostazioni → Provider AI: OpenAI, Ollama in locale, OpenRouter o qualsiasi endpoint OpenAI-compatible</span>],
              [<span key="b" className="ob-ic" style={{ color: '#f472b6' }}>{FamilyIcons.auth}</span>, <span key="bt"><strong>Sicurezza</strong> — la API key viene cifrata nel portachiavi di macOS, mai salvata in chiaro</span>],
              [<span key="c" className="ob-ic" style={{ color: '#ec4899' }}>{FamilyIcons['ai-model']}</span>, <span key="ct"><strong>Prova</strong> — «Aggiungi un Redis tra API e Worker» → vedrai la proposta con Approva/Rifiuta</span>]
            ]}
          />
        </div>
      ),
      actions: [{ label: 'Apri Impostazioni', primary: true, run: openSettings }]
    },
    {
      title: 'MCP: l’architettura per gli agenti',
      body: (
        <div>
          <p className="ob-p">
            ArchiStudio espone un <strong>server MCP</strong>: Cursor, Claude Desktop o qualsiasi
            client possono leggere e proporre modifiche all’architettura.
          </p>
          <Bullets
            items={[
              [<span key="a" className="ob-ic" style={{ color: '#f472b6' }}>{FamilyIcons.auth}</span>, <span key="at"><strong>Modalità</strong> — read-only · approval (predefinita: le modifiche esterne richiedono la tua approvazione) · write</span>],
              [<span key="b" className="ob-ic" style={{ color: '#2dd4bf' }}>{FamilyIcons.realtime}</span>, <span key="bt"><strong>Connessione</strong> — Impostazioni → MCP: snippet pronto per Cursor/Claude e endpoint HTTP locale con token</span>],
              [<span key="c" className="ob-ic" style={{ color: '#34d399' }}>{FamilyIcons.logs}</span>, <span key="ct"><strong>Tracciabilità</strong> — ogni operazione esterna finisce nel log di audit e crea uno snapshot di sicurezza</span>]
            ]}
          />
        </div>
      ),
      actions: [{ label: 'Apri Impostazioni', primary: true, run: openSettings }]
    },
    {
      title: 'Scorciatoie da sapere',
      body: (
        <div>
          <div className="ob-keys">
            <div><Kbd>⌘K</Kbd><span>Palette comandi (tutto da qui)</span></div>
            <div><Kbd>⌘Z</Kbd><span>Annulla / Ripeti (anche AI e MCP)</span></div>
            <div><Kbd>⌘S</Kbd><span>Salva versione (commit git)</span></div>
            <div><Kbd>⌘F</Kbd><span>Cerca nel progetto</span></div>
            <div><Kbd>⌘1 ⌘2 ⌘J</Kbd><span>Mostra/nascondi pannelli</span></div>
            <div><Kbd>⌘/</Kbd><span>Centro assistenza</span></div>
            <div><Kbd>⌘⇧C / V</Kbd><span>Copia / incolla componenti</span></div>
          </div>
          <p className="ob-p ob-muted">Tutte le altre: Aiuto → Centro assistenza → Scorciatoie.</p>
        </div>
      ),
      actions: [{ label: 'Inizia a progettare', primary: true, run: finish }]
    }
  ]

  const step = steps[idx]
  const last = idx === steps.length - 1

  return (
    <div className="modal-overlay ob-overlay">
      <div className="modal ob-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="ob-head">
          <AppLogo size={34} />
          <h3>{step.title}</h3>
        </div>
        <div className="ob-body">{step.body}</div>
        {step.actions && (
          <div className="ob-actions-row">
            {step.actions.map((a) => (
              <button key={a.label} className={a.primary ? 'primary' : ''} onClick={a.run}>
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div className="ob-foot">
          <button className="ghost" onClick={finish}>Salta</button>
          <div className="ob-dots">
            {steps.map((_, i) => (
              <span key={i} className={`ob-dot${i === idx ? ' active' : ''}${i < idx ? ' done' : ''}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {idx > 0 && <button onClick={() => setIdx(idx - 1)}>Indietro</button>}
            {!last && <button className="primary" onClick={() => setIdx(idx + 1)}>Avanti</button>}
            {last && <button className="primary" onClick={finish}>Inizia</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Evita lo schermo bianco: qualsiasi errore di render mostra un pannello di ripristino. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[boundary]', error, info.componentStack)
    // per la diagnostica automatica (smoke)
    ;(window as unknown as Record<string, unknown>).__lastBoundary = {
      message: String(error?.message ?? error),
      stack: String(error?.stack ?? ''),
      componentStack: String(info.componentStack ?? '')
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="welcome">
          <div className="welcome-card">
            <div className="welcome-title" style={{ color: 'var(--error)' }}>Si è verificato un errore inatteso</div>
            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              L'interfaccia si è interrotta ma i tuoi progetti sono al sicuro su disco: ogni modifica
              viene salvata automaticamente. Ricarica per continuare.
            </p>
            <pre className="snippet-box" style={{ maxHeight: 180, overflow: 'auto' }}>
              {String(this.state.error?.stack ?? this.state.error)}
            </pre>
            <div className="welcome-actions" style={{ marginTop: 16 }}>
              <button className="primary" onClick={() => window.location.reload()}>
                Ricarica ArchiStudio
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

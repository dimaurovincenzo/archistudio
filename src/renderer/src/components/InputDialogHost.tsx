import { useEffect, useRef } from 'react'
import { useStore } from '../store'

/** Modale di input stilizzata — window.prompt non esiste in Electron. */
export function InputDialogHost() {
  const input = useStore((s) => s.input)
  const submitInput = useStore((s) => s.submitInput)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (input?.open) {
      setTimeout(() => {
        ref.current?.focus()
        ref.current?.select()
      }, 30)
    }
  }, [input?.open])

  if (!input?.open) return null

  const submit = () => submitInput(ref.current?.value ?? null)

  return (
    <div className="modal-overlay" onSubmit={(e) => e.preventDefault()}>
      <form
        className="modal"
        style={{ width: 420 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h3>{input.title}</h3>
        <input
          ref={ref}
          defaultValue={input.value}
          onKeyDown={(e) => {
            if (e.key === 'Escape') submitInput(null)
          }}
        />
        <div className="modal-actions">
          <button type="button" onClick={() => submitInput(null)}>Annulla</button>
          <button type="submit" className="primary">OK</button>
        </div>
      </form>
    </div>
  )
}

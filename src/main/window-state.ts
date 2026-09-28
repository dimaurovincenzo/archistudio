import { app, screen } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const DEFAULTS: WindowState = { width: 1560, height: 980, maximized: false }

function file(): string {
  return path.join(app.getPath('userData'), 'window-state.json')
}

export function loadWindowState(): WindowState {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8')) as Partial<WindowState>
    const state: WindowState = {
      x: typeof raw.x === 'number' ? raw.x : undefined,
      y: typeof raw.y === 'number' ? raw.y : undefined,
      width: Math.max(1100, Number(raw.width) || DEFAULTS.width),
      height: Math.max(700, Number(raw.height) || DEFAULTS.height),
      maximized: Boolean(raw.maximized)
    }
    // non ripristinare fuori dallo schermo visibile
    const area = screen.getPrimaryDisplay().workArea
    if (state.x !== undefined && state.y !== undefined) {
      const visible =
        state.x < area.x + area.width - 80 &&
        state.x + state.width > area.x + 80 &&
        state.y < area.y + area.height - 40 &&
        state.y + state.height > area.y
      if (!visible) {
        state.x = undefined
        state.y = undefined
      }
    } else {
      state.x = undefined
      state.y = undefined
    }
    return state
  } catch {
    return { ...DEFAULTS }
  }
}

let saveTimer: NodeJS.Timeout | null = null

export function trackWindowState(win: Electron.BrowserWindow): void {
  const save = () => {
    if (win.isDestroyed()) return
    const state: WindowState = win.isMaximized()
      ? { ...loadWindowState(), maximized: true }
      : {
          ...win.getBounds(),
          maximized: false
        }
    try {
      fs.mkdirSync(path.dirname(file()), { recursive: true })
      fs.writeFileSync(file(), JSON.stringify(state), 'utf8')
    } catch {
      /* best effort */
    }
  }
  const debounced = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(save, 600)
  }
  win.on('resize', debounced)
  win.on('move', debounced)
  win.on('close', save)
}

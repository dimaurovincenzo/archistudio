import { app, safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { AppSettings } from '../shared/types'
import { randomBytes } from 'node:crypto'

function defaults(userDataDir: string, documentsDir: string): AppSettings {
  return {
    projectsRoot: path.join(documentsDir, 'ArchiStudio'),
    onboardingDone: false,
    ai: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini',
      temperature: 0.3
    },
    mcp: {
      mode: 'approval',
      httpEnabled: false,
      httpPort: 8742,
      token: randomBytes(24).toString('base64url')
    }
  }
}

export async function loadSettings(): Promise<AppSettings> {
  const userDataDir = app.getPath('userData')
  const file = path.join(userDataDir, 'settings.json')
  const base = defaults(userDataDir, app.getPath('documents'))
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as Partial<AppSettings>
    const settings: AppSettings = {
      projectsRoot: raw.projectsRoot || base.projectsRoot,
      ai: { ...base.ai, ...(raw.ai ?? {}) },
      mcp: { ...base.mcp, ...(raw.mcp ?? {}) }
    }
    // decrypt della API key (Keychain via safeStorage); migrazione dalle chiavi in chiaro
    if (settings.ai.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
      try {
        settings.ai.apiKey = safeStorage.decryptString(Buffer.from(settings.ai.apiKeyEnc, 'base64'))
        settings.ai.apiKeyStored = true
        settings.ai.apiKeyEnc = undefined
      } catch {
        settings.ai.apiKey = ''
      }
    }
    return settings
  } catch {
    await saveSettings(base)
    return base
  }
}

/**
 * Salva le impostazioni su disco SENZA la chiave in chiaro:
 * chiave nuova → cifrata con safeStorage (Keychain su macOS) in apiKeyEnc.
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  const file = path.join(app.getPath('userData'), 'settings.json')
  await fs.mkdir(path.dirname(file), { recursive: true })
  const toDisk: AppSettings = { ...settings, ai: { ...settings.ai, apiKey: '' } }
  if (settings.ai.apiKey) {
    if (safeStorage.isEncryptionAvailable()) {
      toDisk.ai.apiKeyEnc = safeStorage.encryptString(settings.ai.apiKey).toString('base64')
      toDisk.ai.apiKeyStored = true
    } else {
      // fallback: nessun meccanismo di crittazione (es. Linux senza kwallet/gnome-keyring)
      toDisk.ai.apiKey = settings.ai.apiKey
      toDisk.ai.apiKeyStored = false
    }
  }
  await fs.writeFile(file, JSON.stringify(toDisk, null, 2), 'utf8')
}

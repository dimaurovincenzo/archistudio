import { contextBridge, ipcRenderer } from 'electron'
import {
  AiContextRequest,
  AppSettings,
  ArchiModel,
  ArtifactCategory,
  ChatMessage,
  CtxItem,
  McpStatus,
  Op,
  ProjectData,
  ProjectMeta,
  Proposal,
  ValidationIssue,
  VersionSnapshot,
  VersionSnapshotMeta
} from '../shared/types'

type Unsubscribe = () => void

const api = {
  app: {
    info: (): Promise<{ version: string; platform: string }> => ipcRenderer.invoke('app:info'),
    revealProjects: (): Promise<string> => ipcRenderer.invoke('app:reveal-projects'),
    revealProject: (): Promise<string> => ipcRenderer.invoke('app:reveal-project'),
    chooseDir: (): Promise<string | null> => ipcRenderer.invoke('dialog:choose-dir')
  },
  projects: {
    list: (): Promise<ProjectMeta[]> => ipcRenderer.invoke('projects:list'),
    create: (name: string, description?: string): Promise<ProjectMeta> =>
      ipcRenderer.invoke('projects:create', name, description ?? ''),
    open: (id: string): Promise<ProjectData> => ipcRenderer.invoke('projects:open', id),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('projects:delete', id),
    demo: (): Promise<ProjectData> => ipcRenderer.invoke('projects:demo'),
    importJson: (): Promise<ProjectMeta | null> => ipcRenderer.invoke('projects:import-json')
  },
  project: {
    get: (): Promise<ProjectData> => ipcRenderer.invoke('project:get')
  },
  ops: {
    apply: (ops: Op[], source: string): Promise<{ ok: boolean; error?: string; model?: ArchiModel; meta?: ProjectMeta; canUndo?: boolean; canRedo?: boolean }> =>
      ipcRenderer.invoke('ops:apply', ops, source),
    undo: (): Promise<{ ok: boolean; error?: string; model?: ArchiModel; meta?: ProjectMeta; canUndo?: boolean; canRedo?: boolean }> =>
      ipcRenderer.invoke('ops:undo'),
    redo: (): Promise<{ ok: boolean; error?: string; model?: ArchiModel; meta?: ProjectMeta; canUndo?: boolean; canRedo?: boolean }> =>
      ipcRenderer.invoke('ops:redo')
  },
  ctx: {
    show: (items: CtxItem[]): Promise<string | null> => ipcRenderer.invoke('ctx:show', items)
  },
  validate: (): Promise<ValidationIssue[]> => ipcRenderer.invoke('validate'),
  artifacts: {
    generate: (
      category: ArtifactCategory,
      nodeId?: string,
      customTitle?: string
    ): Promise<{ ok: boolean; error?: string; artifact?: ProjectData['model']['artifacts'][number] }> =>
      ipcRenderer.invoke('artifact:generate', category, nodeId, customTitle)
  },
  versions: {
    list: (): Promise<VersionSnapshotMeta[]> => ipcRenderer.invoke('versions:list'),
    create: (label: string): Promise<VersionSnapshot> => ipcRenderer.invoke('versions:create', label),
    restore: (
      id: string
    ): Promise<{ ok: boolean; error?: string; model?: ProjectData['model']; meta?: ProjectData['meta'] }> =>
      ipcRenderer.invoke('versions:restore', id)
  },
  exportFile: (format: 'json' | 'mermaid' | 'svg' | 'png'): Promise<string | null> =>
    ipcRenderer.invoke('export:file', format),
  ai: {
    chat: (history: ChatMessage[], selection: AiContextRequest) =>
      ipcRenderer.invoke('ai:chat', history, selection)
  },
  proposals: {
    list: (): Promise<Proposal[]> => ipcRenderer.invoke('proposals:list'),
    approve: (
      id: string
    ): Promise<{ ok: boolean; error?: string; model?: ProjectData['model']; meta?: ProjectData['meta'] }> =>
      ipcRenderer.invoke('proposals:approve', id),
    reject: (id: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('proposals:reject', id)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (s: AppSettings): Promise<AppSettings> => ipcRenderer.invoke('settings:set', s)
  },
  mcp: {
    status: (): Promise<McpStatus> => ipcRenderer.invoke('mcp:status'),
    catalog: (): Promise<{ tools: { name: string; description: string; write?: boolean }[]; resources: { uri: string; description: string }[] }> =>
      ipcRenderer.invoke('mcp:catalog'),
    httpStart: (): Promise<{ ok: boolean; port?: number; error?: string }> =>
      ipcRenderer.invoke('mcp:http:start'),
    httpStop: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('mcp:http:stop')
  },
  events: {
    onProjectChanged: (cb: () => void): Unsubscribe => {
      const listener = () => cb()
      ipcRenderer.on('project-changed', listener)
      return () => ipcRenderer.removeListener('project-changed', listener)
    },
    onAiDelta: (cb: (delta: string) => void): Unsubscribe => {
      const listener = (_e: unknown, delta: string) => cb(delta)
      ipcRenderer.on('ai:delta', listener)
      return () => ipcRenderer.removeListener('ai:delta', listener)
    },
    onMenuAction: (cb: (id: string) => void): Unsubscribe => {
      const listener = (_e: unknown, id: string) => cb(id)
      ipcRenderer.on('menu-action', listener)
      return () => ipcRenderer.removeListener('menu-action', listener)
    }
  }
}

export type ArchiApi = typeof api

contextBridge.exposeInMainWorld('archi', api)

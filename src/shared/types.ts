export type NodeCategory =
  | 'frontend'
  | 'backend'
  | 'data'
  | 'infrastructure'
  | 'external'
  | 'ai'
  | 'generic'

export interface ArchiNode {
  id: string
  name: string
  type: string
  category: NodeCategory
  description: string
  responsibilities: string[]
  technology: string
  tags: string[]
  properties: Record<string, string>
  groupId: string | null
  position: { x: number; y: number }
  createdAt: string
  updatedAt: string
}

export interface ArchiRelation {
  id: string
  sourceId: string
  targetId: string
  type: string
  direction: 'one-way' | 'two-way'
  description: string
  protocol: string
  payload: string
  metadata: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface ArchiGroup {
  id: string
  name: string
  description: string
  color: string
  createdAt: string
  updatedAt: string
}

export type ArtifactCategory =
  | 'requirements'
  | 'system'
  | 'component'
  | 'api'
  | 'database'
  | 'dataflow'
  | 'adr'
  | 'deployment'

export interface ArchiArtifact {
  id: string
  title: string
  category: ArtifactCategory
  content: string
  nodeIds: string[]
  derived: 'template' | 'ai' | 'manual' | 'mcp'
  createdAt: string
  updatedAt: string
}

export interface ArchiModel {
  nodes: ArchiNode[]
  relations: ArchiRelation[]
  groups: ArchiGroup[]
  artifacts: ArchiArtifact[]
}

export interface ProjectMeta {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  path?: string
}

export interface ProjectData {
  meta: ProjectMeta
  model: ArchiModel
}

export type Op =
  | { op: 'create_node'; node: Partial<ArchiNode> & { name: string } }
  | { op: 'update_node'; id: string; patch: Partial<ArchiNode> }
  | { op: 'delete_node'; id: string }
  | {
      op: 'create_relation'
      relation: Partial<ArchiRelation> & { sourceId: string; targetId: string }
    }
  | { op: 'update_relation'; id: string; patch: Partial<ArchiRelation> }
  | { op: 'delete_relation'; id: string }
  | { op: 'create_group'; group: Partial<ArchiGroup> & { name: string } }
  | { op: 'update_group'; id: string; patch: Partial<ArchiGroup> }
  | { op: 'delete_group'; id: string }
  | {
      op: 'create_artifact'
      artifact: Partial<ArchiArtifact> & { title: string; category: ArtifactCategory }
    }
  | { op: 'update_artifact'; id: string; patch: Partial<ArchiArtifact> }
  | { op: 'delete_artifact'; id: string }
  | { op: 'set_position'; id: string; position: { x: number; y: number } }

export type OpKind = Op['op']

export const OP_KINDS: OpKind[] = [
  'create_node',
  'update_node',
  'delete_node',
  'create_relation',
  'update_relation',
  'delete_relation',
  'create_group',
  'update_group',
  'delete_group',
  'create_artifact',
  'update_artifact',
  'delete_artifact',
  'set_position'
]

export const NODE_CATEGORIES: NodeCategory[] = [
  'frontend',
  'backend',
  'data',
  'infrastructure',
  'external',
  'ai',
  'generic'
]

export const KNOWN_NODE_TYPES: { type: string; category: NodeCategory }[] = [
  { type: 'web-app', category: 'frontend' },
  { type: 'mobile-app', category: 'frontend' },
  { type: 'api', category: 'backend' },
  { type: 'backend', category: 'backend' },
  { type: 'microservice', category: 'backend' },
  { type: 'database', category: 'data' },
  { type: 'cache', category: 'data' },
  { type: 'queue', category: 'infrastructure' },
  { type: 'worker', category: 'backend' },
  { type: 'cron', category: 'infrastructure' },
  { type: 'storage', category: 'infrastructure' },
  { type: 'auth', category: 'backend' },
  { type: 'external-api', category: 'external' },
  { type: 'ai-service', category: 'ai' }
]

export const RELATION_TYPES = [
  'http',
  'rest',
  'graphql',
  'websocket',
  'event',
  'queue',
  'db',
  'auth',
  'dependency',
  'dataflow',
  'component'
]

export const ASYNC_RELATION_TYPES = ['event', 'queue', 'websocket']

export const ARTIFACT_CATEGORIES: ArtifactCategory[] = [
  'requirements',
  'system',
  'component',
  'api',
  'database',
  'dataflow',
  'adr',
  'deployment'
]

export interface ValidationIssue {
  id: string
  severity: 'error' | 'warning'
  code: string
  message: string
  nodeIds?: string[]
  relationIds?: string[]
  artifactIds?: string[]
}

export interface Proposal {
  id: string
  title: string
  summary: string
  ops: Op[]
  source: 'ai' | 'mcp'
  clientInfo?: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface VersionSnapshotMeta {
  id: string
  label: string
  auto: boolean
  source: 'manual' | 'ai' | 'mcp'
  createdAt: string
  counts: { nodes: number; relations: number; groups: number; artifacts: number }
}

export interface VersionSnapshot extends VersionSnapshotMeta {
  model: ArchiModel
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiConfig {
  baseUrl: string
  apiKey: string
  /** true se la chiave è salvata criptata (safeStorage/Keychain); `apiKey` resta vuoto in UI */
  apiKeyStored?: boolean
  /** interno: chiave cifrata base64 (mai esposta al renderer) */
  apiKeyEnc?: string
  model: string
  temperature: number
}

export interface AiContextRequest {
  nodeIds: string[]
  wholeProject: boolean
}

export interface AiChatResult {
  reply: string
  proposal?: Proposal
  error?: string
  model?: string
}

export interface McpStatus {
  mode: 'read-only' | 'write' | 'approval'
  httpRunning: boolean
  httpPort: number
  token: string
  projectsRoot: string
  /** percorso reale del bundle MCP stdio (repo in dev, Resources nell'app pacchettizzata) */
  stdioScript: string
  /** URL completo dell'endpoint HTTP locale */
  httpUrl: string
  /** cartella del progetto correntemente aperto */
  projectDir: string
  /** true se l'app gira pacchettizzata */
  packaged: boolean
}

export interface CtxItem {
  id?: string
  label?: string
  type?: 'separator'
  enabled?: boolean
  accelerator?: string
}

export interface OpsResult {
  ok: boolean
  error?: string
  model?: ArchiModel
  meta?: ProjectMeta
  canUndo?: boolean
  canRedo?: boolean
  applied?: number
}

export interface AppSettings {
  projectsRoot: string
  /** true dopo il tour iniziale */
  onboardingDone?: boolean
  ai: AiConfig
  mcp: {
    mode: 'read-only' | 'write' | 'approval'
    httpEnabled: boolean
    httpPort: number
    token: string
  }
}

import { ReactNode } from 'react'
import { techInfo, TechFamily } from '../../shared/tech'

// Glifi SVG custom per famiglia tecnologica — nessuna emoji, stile stroke coerente.
const S = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const FamilyIcons: Record<TechFamily, ReactNode> = {
  // database
  'db-sql': <S><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></S>,
  'db-doc': <S><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></S>,
  'db-kv': <S><circle cx="8" cy="8" r="4.5" /><path d="M11.3 11.3 20 20M16 16l2-2M18.5 18.5 21 16" /></S>,
  'db-wide': <S><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" /></S>,
  'db-graph': <S><circle cx="6" cy="6" r="2.8" /><circle cx="18" cy="8" r="2.8" /><circle cx="12" cy="18" r="2.8" /><path d="M8.5 7 15.2 7.7M16.8 10.4 13.6 15.7M9.3 8 11 15.4" /></S>,
  'db-ts': <S><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5V19c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5" /><path d="M6.5 12h2.5l1.5-3 2.5 5.5L15 11h2.5" /></S>,
  'db-search': <S><path d="M4 4h13v5M4 4v16h9" /><circle cx="16.5" cy="15.5" r="4" /><path d="m19.5 18.5 2.5 2.5" /></S>,
  'db-vector': <S><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><circle cx="12" cy="12" r="2.6" /><path d="M7.6 7.6 10 10m4 0 2.4-2.4M7.6 16.4 10 14m4 0 2.4 2.4" /></S>,
  cache: <S><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" /></S>,
  queue: <S><path d="M4 6h12M4 12h16M4 18h9M19 4v8m0 0 3-3m-3 3-3-3" /></S>,
  stream: <S><path d="M3 7c3-3 6 3 9 0s6 3 9 0M3 13c3-3 6 3 9 0s6 3 9 0M3 19c3-3 6 3 9 0s6 3 9 0" /></S>,

  // rete / servizi
  api: <S><path d="M8 6 2.5 12 8 18M16 6l5.5 6L16 18M13 4l-2.5 16" /></S>,
  gateway: <S><path d="M4 4h16l-6 8v8l-4-2v-6L4 4z" /></S>,
  lb: <S><circle cx="12" cy="5" r="2.5" /><path d="M12 7.5V12m0 0-6 5m6-5 6 5" /><circle cx="5" cy="18.5" r="2" /><circle cx="19" cy="18.5" r="2" /></S>,
  server: <S><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></S>,
  serverless: <S><path d="M5 4c4 0 4 5 7 5s3-5 7-5M5 20c4 0 4-5 7-5s3 5 7 5" /><path d="M9.5 12h5" /></S>,
  microservice: <S><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></S>,
  worker: <S><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></S>,

  // client
  web: <S><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></S>,
  mobile: <S><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></S>,
  desktop: <S><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M9 21h6M12 17v4" /></S>,
  framework: <S><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="m9.5 9.5-2.5 2.5 2.5 2.5M14.5 9.5l2.5 2.5-2.5 2.5" /></S>,
  language: <S><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M10 11l-2 3 2 3M14 11l2 3-2 3" /></S>,

  // infrastruttura
  container: <S><rect x="3" y="9" width="18" height="9" rx="1.5" /><path d="M6 9V6.5h3V9m2.5 0V6.5h3V9m2.5 0V6.5h3V9M5.5 12.5h.01M9 12.5h.01M12.5 12.5h.01M16 12.5h.01" /></S>,
  k8s: <S><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><path d="M12 3.5V9M12 15v5.5M3.8 9.2l5 1.8M15.2 13l5 1.8M4 15l5.2-1.8M15 9.2l5.2-1.8" /></S>,
  proxy: <S><path d="M3 6h14m0 0-3-3m3 3-3 3M21 18H7m0 0 3-3m-3 3 3 3" /><circle cx="19.5" cy="6" r="1.8" /><circle cx="4.5" cy="18" r="1.8" /></S>,
  cdn: <S><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></S>,
  cloud: <S><path d="M7 18.5a4.5 4.5 0 0 1-.4-9A5.5 5.5 0 0 1 17.3 9a4 4 0 0 1-.3 8z" /></S>,
  storage: <S><rect x="3" y="3" width="18" height="8" rx="2" /><rect x="3" y="13" width="18" height="8" rx="2" /><path d="M7 7h.01M7 17h.01" /></S>,

  // domini
  auth: <S><path d="M12 2.5 4.5 5.5v6c0 4.7 3.2 8 7.5 10 4.3-2 7.5-5.3 7.5-10v-6L12 2.5z" /><path d="m9 12 2 2 4-4.5" /></S>,
  payment: <S><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19M6 15h4" /></S>,
  mail: <S><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7.5 9 6 9-6" /></S>,
  notify: <S><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></S>,
  realtime: <S><path d="M2.5 9.5a10 10 0 0 1 19 0M5.5 13a6.5 6.5 0 0 1 13 0" /><circle cx="12" cy="18" r="2.2" /></S>,

  // AI
  'ai-model': <S><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M9.5 9.5h5v5h-5z" /></S>,
  'ai-ml': <S><path d="M12 3a5 5 0 0 1 5 5c0 1.2-.4 2.2-1 3 1.9.9 3 2.6 3 4.5A4.5 4.5 0 0 1 14.5 20h-5A4.5 4.5 0 0 1 5 15.5c0-1.9 1.1-3.6 3-4.5-.6-.8-1-1.8-1-3a5 5 0 0 1 5-5z" /><path d="M12 3v17" /></S>,
  workflow: <S><circle cx="6" cy="6" r="2.6" /><circle cx="18" cy="18" r="2.6" /><path d="M8.6 6H15a3 3 0 0 1 3 3v6.6M6 8.6V15a3 3 0 0 0 3 3h6.6" /></S>,
  cicd: <S><path d="M20 8A8.5 8.5 0 0 0 5 6.5L3 8.5M4 16a8.5 8.5 0 0 0 15 1.5l2-2" /><path d="M3 4.5v4h4M21 19.5v-4h-4" /><circle cx="12" cy="12" r="2.5" /></S>,
  iac: <S><path d="m12 3 9 4.5-9 4.5-9-4.5L12 3z" /><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" /></S>,
  monitor: <S><path d="M3 12h4l2.5-6 4 12L16 12h5" /></S>,
  logs: <S><path d="M5 4h14v16H5z" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" /></S>,
  cron: <S><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></S>,
  external: <S><path d="M17 3h4v4M21 3l-8 8M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" /></S>,
  generic: <S><rect x="4" y="4" width="16" height="16" rx="3" /></S>
}


export function nodeIcon(type: string): ReactNode {
  const fam = techInfo(type).family
  return FamilyIcons[fam] ?? FamilyIcons.generic
}

export function techColor(type: string, fallbackCategory?: string): string {
  const info = techInfo(type)
  if (info.known) return info.color
  return (fallbackCategory && CATEGORY_COLORS[fallbackCategory]) || CATEGORY_COLORS.generic
}

export function techLabel(type: string): string {
  return techInfo(type).label
}

export const CATEGORY_COLORS: Record<string, string> = {
  frontend: '#22d3ee',
  backend: '#6366f1',
  data: '#f59e0b',
  infrastructure: '#a78bfa',
  external: '#64748b',
  ai: '#ec4899',
  generic: '#94a3b8'
}

export const RELATION_COLORS: Record<string, string> = {
  http: '#38bdf8',
  rest: '#38bdf8',
  graphql: '#818cf8',
  websocket: '#2dd4bf',
  event: '#fbbf24',
  queue: '#fb923c',
  db: '#f59e0b',
  auth: '#f472b6',
  dependency: '#7d8699',
  dataflow: '#34d399',
  component: '#5c6478'
}

export function relationColor(type: string): string {
  return RELATION_COLORS[type] ?? '#7d8699'
}

export const AppLogo = ({ size = 44 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <rect x="1.5" y="1.5" width="41" height="41" rx="11" fill="#131826" stroke="#2e374b" strokeWidth="1.5" />
    <circle cx="14" cy="14" r="4.5" fill="#22d3ee" />
    <circle cx="31" cy="20" r="4.5" fill="#6366f1" />
    <circle cx="18" cy="32" r="4.5" fill="#f59e0b" />
    <path d="M18 16.5 26.5 19M15.5 18.5l1.8 9M29 24.5l-8.5 5" stroke="#3a455e" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

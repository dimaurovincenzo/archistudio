import { applyOps } from './ops'
import { ProjectManager } from './projects'
import { ArchiNode, Op } from '../shared/types'
import { templates } from './demo-templates'

const P = (x: number, y: number) => ({ x, y })

interface SeedNode {
  name: string
  type: string
  category: ArchiNode['category']
  technology: string
  description: string
  responsibilities: string[]
  position: { x: number; y: number }
  properties?: Record<string, string>
}

/** Demo: architettura di una piattaforma web — welcome screen e screenshot del README. */
const SEED_NODES: SeedNode[] = [
  { name: 'Web App', type: 'react', category: 'frontend', technology: 'React 19 + Vite', description: 'Sito pubblico: catalogo, checkout e area utente.', responsibilities: ['Rendering pagine', 'Sessione utente', 'Chiamate API'], position: P(120, 220), properties: { domain: 'example.com' } },
  { name: 'Admin Panel', type: 'react', category: 'frontend', technology: 'React 19', description: 'Backoffice interno: contenuti, ordini, report.', responsibilities: ['Gestione contenuti', 'Monitoraggio ordini'], position: P(120, 480) },
  { name: 'CDN', type: 'cloudflare', category: 'infrastructure', technology: 'Cloudflare', description: 'Edge cache degli statici e terminazione TLS.', responsibilities: ['Cache asset e immagini', 'Protezione DDoS'], position: P(500, 100), properties: { domain: 'example.com' } },
  { name: 'API', type: 'nodejs', category: 'backend', technology: 'Node.js 22 + Express', description: 'API REST del dominio: unica via di accesso ai dati.', responsibilities: ['Endpoint REST /v1', 'Validazione e rate limit', 'JWT di sessione'], position: P(500, 360), properties: { port: '3000', instances: '2×' } },
  { name: 'Auth Service', type: 'keycloak', category: 'backend', technology: 'Keycloak', description: 'Identità e accesso: OIDC, ruoli, MFA.', responsibilities: ['Login e refresh token', 'Ruoli e permessi'], position: P(500, 620), properties: { port: '8080' } },
  { name: 'Queue', type: 'rabbitmq', category: 'infrastructure', technology: 'RabbitMQ', description: 'Coda dei lavori asincroni tra API e Worker.', responsibilities: ['Buffer job', 'Retry con DLQ'], position: P(500, 860), properties: { port: '5672' } },
  { name: 'Worker', type: 'nodejs', category: 'backend', technology: 'Node.js 22', description: 'Elaborazione asincrona: email, report, resize immagini.', responsibilities: ['Consumo code', 'Invio email', 'Resize immagini'], position: P(900, 200) },
  { name: 'Redis', type: 'redis', category: 'data', technology: 'Redis 7', description: 'Cache di lettura e sessioni condivise.', responsibilities: ['Cache query', 'Sessioni'], position: P(900, 440), properties: { port: '6379' } },
  { name: 'PostgreSQL', type: 'postgresql', category: 'data', technology: 'PostgreSQL 16', description: 'Dato di dominio: utenti, catalogo, ordini.', responsibilities: ['Archivio transazionale ACID'], position: P(900, 680), properties: { port: '5432' } },
  { name: 'Payments', type: 'stripe', category: 'external', technology: 'Stripe', description: 'Pagamenti con carta e webhook di conferma.', responsibilities: ['Checkout', 'Webhook payment_intent'], position: P(900, 900) },
  { name: 'Object Storage', type: 's3', category: 'infrastructure', technology: 'S3-compatible', description: 'Bucket degli asset: immagini prodotto, export.', responsibilities: ['Storage asset', 'URL firmati'], position: P(1300, 200) },
  { name: 'Email', type: 'sendgrid', category: 'external', technology: 'SendGrid', description: 'Email transazionali: conferme, ricevute, reset.', responsibilities: ['Invio email'], position: P(1300, 440) },
  { name: 'Prometheus', type: 'prometheus', category: 'infrastructure', technology: 'Prometheus', description: 'Metriche di servizi e infrastruttura.', responsibilities: ['Scrape /metrics', 'Alerting'], position: P(1300, 680) },
  { name: 'Grafana', type: 'grafana', category: 'infrastructure', technology: 'Grafana', description: 'Dashboard operative.', responsibilities: ['Dashboard'], position: P(1300, 900) }
]

interface SeedRelation {
  from: string
  to: string
  type: string
  protocol?: string
  description?: string
  payload?: string
  direction?: 'one-way' | 'two-way'
}

const SEED_RELATIONS: SeedRelation[] = [
  { from: 'Web App', to: 'CDN', type: 'http', protocol: 'HTTPS', description: 'Statici e pagine' },
  { from: 'CDN', to: 'API', type: 'rest', protocol: 'HTTPS /v1', description: 'Proxy delle chiamate dinamiche' },
  { from: 'Admin Panel', to: 'API', type: 'rest', protocol: 'HTTPS /v1', description: 'Operazioni di backoffice' },
  { from: 'API', to: 'Auth Service', type: 'auth', protocol: 'OIDC', description: 'Verifica token e ruoli' },
  { from: 'API', to: 'Redis', type: 'db', protocol: 'RESP', description: 'Cache e sessioni' },
  { from: 'API', to: 'PostgreSQL', type: 'db', protocol: 'SQL', description: 'Lettura/scrittura dominio' },
  { from: 'API', to: 'Queue', type: 'queue', protocol: 'AMQP', description: 'Pubblica job asincroni', payload: 'order.created' },
  { from: 'API', to: 'Payments', type: 'http', protocol: 'HTTPS', description: 'Creazione pagamento', direction: 'two-way' },
  { from: 'Worker', to: 'Queue', type: 'queue', protocol: 'AMQP', description: 'Consumo job con retry' },
  { from: 'Worker', to: 'PostgreSQL', type: 'db', description: 'Aggiornamenti post-lavoro' },
  { from: 'Worker', to: 'Object Storage', type: 'http', description: 'Upload asset processati' },
  { from: 'Worker', to: 'Email', type: 'mail', description: 'Email transazionali' },
  { from: 'API', to: 'Prometheus', type: 'dataflow', description: '/metrics' },
  { from: 'Worker', to: 'Prometheus', type: 'dataflow', description: '/metrics' },
  { from: 'Prometheus', to: 'Grafana', type: 'dataflow', description: 'Serie e dashboard' }
]

const SEED_GROUPS: { name: string; color: string; members: string[] }[] = [
  { name: 'Clienti', color: '#22d3ee', members: ['Web App', 'Admin Panel'] },
  { name: 'Servizi', color: '#6366f1', members: ['API', 'Auth Service', 'Worker'] },
  { name: 'Dati', color: '#f59e0b', members: ['PostgreSQL', 'Redis', 'Object Storage'] },
  { name: 'Esterni', color: '#64748b', members: ['Payments', 'Email'] },
  { name: 'Operazioni', color: '#ec4899', members: ['Prometheus', 'Grafana', 'Queue', 'CDN'] }
]

/** Crea (una volta) il progetto demo usato dalla welcome e dagli screenshot. */
export async function seedDemoProject(manager: ProjectManager): Promise<import('../shared/types').ProjectMeta> {
  const projects = await manager.listProjects()
  const existing = projects.find((p) => p.name === 'Piattaforma Web — Demo')
  if (existing) return existing
  const meta = await manager.createProject('Piattaforma Web — Demo', 'Architettura di esempio: sito web con API, cache, code e osservabilità')
  await manager.openProject(meta.id)
  const store = manager.store

  const nodeOps: Op[] = SEED_NODES.map((n) => ({
    op: 'create_node',
    node: { ...n, tags: [n.type] }
  }))
  const res = applyOps(store.model, nodeOps)
  if (!res.ok) throw new Error(res.error)
  await store.persist()

  // secondo passaggio: le relazioni risolvono contro gli id reali
  const idByName = new Map(store.model.nodes.map((n) => [n.name, n.id]))
  const relOps: Op[] = SEED_RELATIONS.map((r) => ({
    op: 'create_relation',
    relation: {
      sourceId: idByName.get(r.from)!,
      targetId: idByName.get(r.to)!,
      type: r.type,
      protocol: r.protocol ?? '',
      description: r.description ?? '',
      payload: r.payload ?? '',
      direction: r.direction ?? 'one-way'
    }
  }))
  const res2 = applyOps(store.model, relOps)
  if (!res2.ok) throw new Error(res2.error)
  await store.persist()

  for (const g of SEED_GROUPS) {
    const rg = applyOps(store.model, [{ op: 'create_group', group: { name: g.name, color: g.color } }])
    if (!rg.ok) throw new Error(rg.error)
    const gid = store.model.groups[store.model.groups.length - 1].id
    applyOps(store.model, g.members.map((m) => ({ op: 'update_node', id: idByName.get(m)!, patch: { groupId: gid } })))
  }
  await store.persist()

  applyOps(store.model, [
    { op: 'create_artifact', artifact: { ...templates.system(store), category: 'system', derived: 'template' } }
  ])
  await store.persist()
  return meta
}

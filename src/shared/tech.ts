import { NodeCategory, NODE_CATEGORIES } from './types'

/**
 * Catalogo delle tecnologie riconosciute da ArchiStudio.
 * Ogni voce mappa un `type` (id minuscolo, usato nei nodi) a:
 *  - label leggibile (mostrata su canvas, inspector, explorer)
 *  - family  → glifo SVG dedicato (vedi FamilyIcons in renderer/icons.tsx)
 *  - category → categoria architetturale (colore di gruppo, validazione, AI)
 *  - color   → colore riconoscibile della tecnologia (tile icona, minimap)
 */
export interface TechEntry {
  type: string
  label: string
  family: TechFamily
  category: NodeCategory
  color: string
  keywords?: string
}

export type TechFamily =
  | 'db-sql'
  | 'db-doc'
  | 'db-kv'
  | 'db-wide'
  | 'db-graph'
  | 'db-ts'
  | 'db-search'
  | 'db-vector'
  | 'cache'
  | 'queue'
  | 'stream'
  | 'api'
  | 'gateway'
  | 'lb'
  | 'server'
  | 'serverless'
  | 'web'
  | 'mobile'
  | 'desktop'
  | 'framework'
  | 'language'
  | 'container'
  | 'k8s'
  | 'proxy'
  | 'cdn'
  | 'cloud'
  | 'storage'
  | 'auth'
  | 'payment'
  | 'mail'
  | 'notify'
  | 'realtime'
  | 'ai-model'
  | 'ai-ml'
  | 'workflow'
  | 'cicd'
  | 'iac'
  | 'monitor'
  | 'logs'
  | 'cron'
  | 'external'
  | 'worker'
  | 'microservice'
  | 'generic'

const t = (type: string, label: string, family: TechFamily, category: NodeCategory, color: string, keywords?: string): TechEntry =>
  ({ type, label, family, category, color, keywords })

export const TECH_CATALOG: TechEntry[] = [
  // ---- Database relazionali (SQL) ------------------------------------------
  t('postgresql', 'PostgreSQL', 'db-sql', 'data', '#4a8fd4', 'postgres pg'),
  t('mysql', 'MySQL', 'db-sql', 'data', '#00758f', 'maria'),
  t('mariadb', 'MariaDB', 'db-sql', 'data', '#c0765a'),
  t('sqlite', 'SQLite', 'db-sql', 'data', '#0f80cc'),
  t('sqlserver', 'SQL Server', 'db-sql', 'data', '#a2322e', 'mssql microsoft'),
  t('oracle', 'Oracle DB', 'db-sql', 'data', '#e04e39'),
  t('clickhouse', 'ClickHouse', 'db-sql', 'data', '#e3b341'),
  t('duckdb', 'DuckDB', 'db-sql', 'data', '#e3c000'),
  t('cockroachdb', 'CockroachDB', 'db-sql', 'data', '#6933ff', 'cockroach'),
  t('snowflake', 'Snowflake', 'db-sql', 'data', '#29b5e8', 'warehouse dwh'),
  t('bigquery', 'BigQuery', 'db-sql', 'data', '#4285f4', 'gcp warehouse'),

  // ---- Database documentali -------------------------------------------------
  t('mongodb', 'MongoDB', 'db-doc', 'data', '#47a248', 'mongo'),
  t('couchdb', 'CouchDB', 'db-doc', 'data', '#e42528', 'couch'),
  t('firestore', 'Firestore', 'db-doc', 'data', '#ffa000', 'firebase document'),
  t('ravenbdb', 'RavenDB', 'db-doc', 'data', '#c0392b'),

  // ---- Key-value -------------------------------------------------------------
  t('dynamodb', 'DynamoDB', 'db-kv', 'data', '#4053d6', 'aws dynamo'),
  t('etcd', 'etcd', 'db-kv', 'data', '#419eba'),
  t('badger', 'BadgerDB', 'db-kv', 'data', '#cc4b4b'),

  // ---- Wide-column -----------------------------------------------------------
  t('cassandra', 'Cassandra', 'db-wide', 'data', '#1287b1'),
  t('scylladb', 'ScyllaDB', 'db-wide', 'data', '#7b68ee', 'scylla'),

  // ---- Grafo ------------------------------------------------------------------
  t('neo4j', 'Neo4j', 'db-graph', 'data', '#008cc1', 'graph'),
  t('arangodb', 'ArangoDB', 'db-graph', 'data', '#4e8cb0', 'graph'),

  // ---- Time series --------------------------------------------------------------
  t('influxdb', 'InfluxDB', 'db-ts', 'data', '#22adf6', 'influx timeseries'),
  t('timescaledb', 'TimescaleDB', 'db-ts', 'data', '#fdb515', 'timescale'),

  // ---- Search ----------------------------------------------------------------------
  t('elasticsearch', 'Elasticsearch', 'db-search', 'data', '#00bfb3', 'elastic lucene'),
  t('opensearch', 'OpenSearch', 'db-search', 'data', '#005eb8'),
  t('meilisearch', 'Meilisearch', 'db-search', 'data', '#ff5caa', 'meili'),
  t('typesense', 'Typesense', 'db-search', 'data', '#dc205e'),
  t('algolia', 'Algolia', 'db-search', 'data', '#3f51f5'),
  t('solr', 'Apache Solr', 'db-search', 'data', '#d9411e'),

  // ---- Vector / AI data ---------------------------------------------------------------
  t('pinecone', 'Pinecone', 'db-vector', 'ai', '#4c2a85', 'vector embeddings'),
  t('qdrant', 'Qdrant', 'db-vector', 'ai', '#dc244c', 'vector'),
  t('weaviate', 'Weaviate', 'db-vector', 'ai', '#7a73ff', 'vector'),
  t('milvus', 'Milvus', 'db-vector', 'ai', '#00a1ea', 'vector'),
  t('pgvector', 'pgvector', 'db-vector', 'ai', '#4a8fd4', 'postgres vector embeddings'),
  t('chroma', 'ChromaDB', 'db-vector', 'ai', '#ff6f3c', 'vector chromadb'),

  // ---- Cache ------------------------------------------------------------------------------
  t('redis', 'Redis', 'cache', 'data', '#d82c20'),
  t('memcached', 'Memcached', 'cache', 'data', '#4db6ac', 'memcache'),
  t('keydb', 'KeyDB', 'cache', 'data', '#e8622d'),

  // ---- Code / stream ------------------------------------------------------------------------
  t('rabbitmq', 'RabbitMQ', 'queue', 'infrastructure', '#ff6600', 'amqp queue'),
  t('sqs', 'AWS SQS', 'queue', 'infrastructure', '#e2833a', 'aws queue'),
  t('activemq', 'ActiveMQ', 'queue', 'infrastructure', '#f1592a', 'queue'),
  t('kafka', 'Apache Kafka', 'stream', 'infrastructure', '#4b4b4b', 'stream events'),
  t('nats', 'NATS', 'stream', 'infrastructure', '#27aae1', 'stream messaging'),
  t('pulsar', 'Apache Pulsar', 'stream', 'infrastructure', '#3b82f6', 'stream'),
  t('kinesis', 'AWS Kinesis', 'stream', 'infrastructure', '#e2833a', 'aws stream'),

  // ---- API / rete -----------------------------------------------------------------------------
  t('graphql', 'GraphQL', 'api', 'backend', '#e10098', 'apollo'),
  t('grpc', 'gRPC', 'api', 'backend', '#3b82f6', 'protobuf rpc'),
  t('webhook', 'Webhook', 'api', 'backend', '#8b93a7'),
  t('websocket', 'WebSocket', 'realtime', 'backend', '#2dd4bf', 'ws realtime'),
  t('socketio', 'Socket.IO', 'realtime', 'backend', '#6e7681', 'socket realtime'),
  t('pusher', 'Pusher', 'realtime', 'infrastructure', '#300d4f', 'realtime'),
  t('ably', 'Ably', 'realtime', 'infrastructure', '#ff5a5f', 'realtime'),

  // ---- Server / runtime -------------------------------------------------------------------------
  t('api', 'API', 'api', 'backend', '#6366f1', 'rest endpoint'),
  t('backend', 'Backend', 'server', 'backend', '#6366f1', 'service'),
  t('microservice', 'Microservizio', 'microservice', 'backend', '#818cf8', 'microservice'),
  t('worker', 'Worker', 'worker', 'backend', '#6366f1', 'job consumer'),
  t('nodejs', 'Node.js', 'language', 'backend', '#339933', 'node express javascript runtime'),
  t('deno', 'Deno', 'language', 'backend', '#3b8c5a'),
  t('bun', 'Bun', 'language', 'backend', '#e3c078'),
  t('python', 'Python', 'language', 'backend', '#3776ab', 'django fastapi flask'),
  t('java', 'Java', 'language', 'backend', '#e76f00', 'jvm spring'),
  t('kotlin', 'Kotlin', 'language', 'backend', '#7f52ff', 'jvm'),
  t('go', 'Go', 'language', 'backend', '#00add8', 'golang'),
  t('rust', 'Rust', 'language', 'backend', '#b7410e', 'actix axum'),
  t('php', 'PHP', 'language', 'backend', '#777bb4', 'laravel symfony'),
  t('ruby', 'Ruby', 'language', 'backend', '#cc342d', 'rails'),
  t('csharp', 'C#', 'language', 'backend', '#68217a', 'dotnet c sharp'),
  t('dotnet', '.NET', 'language', 'backend', '#512bd4', 'dotnet aspnet'),
  t('elixir', 'Elixir', 'language', 'backend', '#4b275f', 'phoenix'),
  t('scala', 'Scala', 'language', 'backend', '#dc322f', 'jvm akka'),
  t('typescript', 'TypeScript', 'language', 'frontend', '#3178c6', 'ts'),
  t('javascript', 'JavaScript', 'language', 'frontend', '#d8b800', 'js'),

  // ---- Framework ---------------------------------------------------------------------------------
  t('nextjs', 'Next.js', 'framework', 'frontend', '#6e7681', 'next react ssr'),
  t('nuxt', 'Nuxt', 'framework', 'frontend', '#00dc82', 'vue ssr'),
  t('remix', 'Remix', 'framework', 'frontend', '#3992ff', 'react ssr'),
  t('django', 'Django', 'framework', 'backend', '#0e7a4a', 'python'),
  t('fastapi', 'FastAPI', 'framework', 'backend', '#009688', 'python'),
  t('spring', 'Spring Boot', 'framework', 'backend', '#6db33f', 'java boot'),
  t('laravel', 'Laravel', 'framework', 'backend', '#ff2d20', 'php'),
  t('symfony', 'Symfony', 'framework', 'backend', '#5c6478', 'php'),
  t('nestjs', 'NestJS', 'framework', 'backend', '#e0234e', 'node'),
  t('express', 'Express', 'framework', 'backend', '#5c6478', 'node'),
  t('rails', 'Ruby on Rails', 'framework', 'backend', '#cc342d', 'ror'),
  t('phoenix', 'Phoenix', 'framework', 'backend', '#f05138', 'elixir'),

  // ---- Frontend ------------------------------------------------------------------------------------
  t('web-app', 'Web App', 'web', 'frontend', '#22d3ee', 'spa website frontend'),
  t('react', 'React', 'framework', 'frontend', '#61dafb', 'reactjs'),
  t('vue', 'Vue', 'framework', 'frontend', '#42b883', 'vuejs'),
  t('angular', 'Angular', 'framework', 'frontend', '#dd0031'),
  t('svelte', 'Svelte', 'framework', 'frontend', '#ff3e00', 'sveltekit'),
  t('astro', 'Astro', 'framework', 'frontend', '#ff5d01'),
  t('tailwind', 'Tailwind CSS', 'framework', 'frontend', '#38bdf8', 'css'),
  t('mobile-app', 'Mobile App', 'mobile', 'frontend', '#22d3ee', 'app ios android'),
  t('react-native', 'React Native', 'mobile', 'frontend', '#61dafb', 'expo mobile'),
  t('flutter', 'Flutter', 'mobile', 'frontend', '#02569b', 'dart mobile'),
  t('swiftui', 'SwiftUI', 'mobile', 'frontend', '#f05138', 'ios'),
  t('desktop-app', 'Desktop App', 'desktop', 'frontend', '#22d3ee', 'electron tauri'),
  t('electron', 'Electron', 'desktop', 'frontend', '#47848f'),

  // ---- Infrastruttura --------------------------------------------------------------------------------
  t('docker', 'Docker', 'container', 'infrastructure', '#2496ed', 'container'),
  t('podman', 'Podman', 'container', 'infrastructure', '#892ca0', 'container'),
  t('kubernetes', 'Kubernetes', 'k8s', 'infrastructure', '#326ce5', 'k8s orchestration'),
  t('nomad', 'HashiCorp Nomad', 'k8s', 'infrastructure', '#00ca8e', 'orchestration'),
  t('nginx', 'Nginx', 'proxy', 'infrastructure', '#009639', 'webserver reverse proxy'),
  t('traefik', 'Traefik', 'proxy', 'infrastructure', '#24a1c1', 'reverse proxy'),
  t('caddy', 'Caddy', 'proxy', 'infrastructure', '#1f88c0', 'reverse proxy'),
  t('haproxy', 'HAProxy', 'lb', 'infrastructure', '#2c3e50', 'load balancer'),
  t('envoy', 'Envoy', 'lb', 'infrastructure', '#7d90a0', 'proxy mesh'),
  t('cdn', 'CDN', 'cdn', 'infrastructure', '#f38020', 'edge cache'),
  t('cloudflare', 'Cloudflare', 'cdn', 'infrastructure', '#f38020', 'edge workers'),
  t('fastly', 'Fastly', 'cdn', 'infrastructure', '#ff282d', 'edge cdn'),

  // ---- Cloud -------------------------------------------------------------------------------------------
  t('aws', 'AWS', 'cloud', 'infrastructure', '#ff9900', 'amazon'),
  t('gcp', 'Google Cloud', 'cloud', 'infrastructure', '#4285f4', 'google'),
  t('azure', 'Azure', 'cloud', 'infrastructure', '#0078d4', 'microsoft'),
  t('lambda', 'AWS Lambda', 'serverless', 'infrastructure', '#ff9900', 'aws function faas'),
  t('cloudfunctions', 'Cloud Functions', 'serverless', 'infrastructure', '#4285f4', 'gcp faas'),
  t('cloudflare-workers', 'Cloudflare Workers', 'serverless', 'infrastructure', '#f38020', 'edge faas'),
  t('vercel', 'Vercel', 'cloud', 'infrastructure', '#6e7681', 'hosting'),
  t('netlify', 'Netlify', 'cloud', 'infrastructure', '#00c7b7', 'hosting'),
  t('heroku', 'Heroku', 'cloud', 'infrastructure', '#430098', 'paas'),
  t('digitalocean', 'DigitalOcean', 'cloud', 'infrastructure', '#0080ff', 'droplet'),
  t('s3', 'S3', 'storage', 'infrastructure', '#7aa116', 'aws object storage bucket'),
  t('gcs', 'Google Cloud Storage', 'storage', 'infrastructure', '#4285f4', 'bucket'),
  t('minio', 'MinIO', 'storage', 'infrastructure', '#c72e49', 'object storage'),

  // ---- Autenticazione ------------------------------------------------------------------------------------
  t('auth', 'Servizio Auth', 'auth', 'backend', '#f472b6', 'authentication authorization'),
  t('keycloak', 'Keycloak', 'auth', 'backend', '#4d9fdc', 'identity sso oidc'),
  t('auth0', 'Auth0', 'auth', 'backend', '#eb5424', 'identity sso'),
  t('cognito', 'AWS Cognito', 'auth', 'backend', '#e2833a', 'aws identity'),
  t('clerk', 'Clerk', 'auth', 'backend', '#6c47ff', 'identity'),
  t('supabase', 'Supabase', 'db-sql', 'data', '#3ecf8e', 'postgres baas realtime'),
  t('firebase', 'Firebase', 'db-doc', 'data', '#ffca28', 'google baas'),
  t('appwrite', 'Appwrite', 'db-doc', 'data', '#f02e65', 'baas'),
  t('pocketbase', 'PocketBase', 'db-sql', 'data', '#5b8bd0', 'baas sqlite'),

  // ---- Pagamenti / comunicazione ----------------------------------------------------------------------------
  t('stripe', 'Stripe', 'payment', 'external', '#635bff', 'payments checkout'),
  t('paypal', 'PayPal', 'payment', 'external', '#00457c', 'payments'),
  t('adyen', 'Adyen', 'payment', 'external', '#0abf53', 'payments'),
  t('sendgrid', 'SendGrid', 'mail', 'external', '#1a82e2', 'email transactional'),
  t('ses', 'AWS SES', 'mail', 'external', '#dd8b33', 'aws email'),
  t('postmark', 'Postmark', 'mail', 'external', '#d9b310', 'email transactional'),
  t('twilio', 'Twilio', 'notify', 'external', '#f22f46', 'sms voice'),
  t('fcm', 'Firebase Cloud Messaging', 'notify', 'external', '#ffca28', 'push notification'),
  t('onesignal', 'OneSignal', 'notify', 'external', '#e54b4d', 'push notification'),

  // ---- AI -----------------------------------------------------------------------------------------------------
  t('ai-service', 'AI Service', 'ai-model', 'ai', '#ec4899', 'llm ml'),
  t('openai', 'OpenAI', 'ai-model', 'ai', '#10a37f', 'gpt chatgpt llm'),
  t('anthropic', 'Anthropic', 'ai-model', 'ai', '#cc785c', 'claude llm'),
  t('gemini', 'Google Gemini', 'ai-model', 'ai', '#7b68ee', 'llm'),
  t('ollama', 'Ollama', 'ai-model', 'ai', '#4e4e60', 'local llm'),
  t('mistral', 'Mistral', 'ai-model', 'ai', '#fa520f', 'llm'),
  t('langchain', 'LangChain', 'ai-ml', 'ai', '#2e7d6b', 'llm orchestration rag'),
  t('llamaindex', 'LlamaIndex', 'ai-ml', 'ai', '#e48484', 'rag llm'),
  t('huggingface', 'Hugging Face', 'ai-ml', 'ai', '#e3b341', 'transformers models'),

  // ---- Workflow / CI / observability -----------------------------------------------------------------------------
  t('temporal', 'Temporal', 'workflow', 'infrastructure', '#444ce7', 'durable workflow'),
  t('n8n', 'n8n', 'workflow', 'infrastructure', '#ea4b71', 'automation workflow'),
  t('celery', 'Celery', 'workflow', 'infrastructure', '#37814a', 'python jobs'),
  t('github-actions', 'GitHub Actions', 'cicd', 'infrastructure', '#2088ff', 'ci cd pipeline'),
  t('gitlab-ci', 'GitLab CI', 'cicd', 'infrastructure', '#fc6d26', 'ci cd pipeline'),
  t('jenkins', 'Jenkins', 'cicd', 'infrastructure', '#d33833', 'ci cd'),
  t('argo', 'Argo CD', 'cicd', 'infrastructure', '#ef7b4d', 'gitops cd'),
  t('terraform', 'Terraform', 'iac', 'infrastructure', '#7b42bc', 'iac infrastructure code'),
  t('pulumi', 'Pulumi', 'iac', 'infrastructure', '#8a3391', 'iac'),
  t('prometheus', 'Prometheus', 'monitor', 'infrastructure', '#e6522c', 'metrics monitoring'),
  t('grafana', 'Grafana', 'monitor', 'infrastructure', '#f46800', 'dashboards monitoring'),
  t('datadog', 'Datadog', 'monitor', 'infrastructure', '#632ca6', 'monitoring apm'),
  t('sentry', 'Sentry', 'monitor', 'infrastructure', '#5551c6', 'error tracking'),
  t('loki', 'Grafana Loki', 'logs', 'infrastructure', '#c9a227', 'logs'),
  t('graylog', 'Graylog', 'logs', 'infrastructure', '#4fa8ff', 'logs'),

  // ---- Generici architetturali --------------------------------------------------------------------------------------
  t('cron', 'Cron Job', 'cron', 'infrastructure', '#a78bfa', 'scheduled task'),
  t('storage', 'Storage', 'storage', 'infrastructure', '#a78bfa', 'disk files'),
  t('external-api', 'External API', 'external', 'external', '#64748b', 'third party'),
  t('generic', 'Generico', 'generic', 'generic', '#94a3b8')
]

export const TECH_BY_TYPE: Map<string, TechEntry> = new Map(TECH_CATALOG.map((e) => [e.type, e]))

const FAMILY_ALIASES: Record<string, TechFamily> = {
  'web-app': 'web',
  'mobile-app': 'mobile',
  backend: 'server',
  database: 'db-sql'
}

export interface TechInfo {
  type: string
  label: string
  family: TechFamily
  category: NodeCategory
  color: string
  known: boolean
}

/** Info arricchita per un type qualsiasi (noto o custom). Fallback: generico. */
export function techInfo(type: string): TechInfo {
  const known = TECH_BY_TYPE.get(type)
  if (known) return { ...known, known: true }
  const alias = FAMILY_ALIASES[type]
  const legacy: Record<string, { label: string; category: NodeCategory; color: string }> = {
    web: { label: 'Web App', category: 'frontend', color: '#22d3ee' },
    mobile: { label: 'Mobile App', category: 'frontend', color: '#22d3ee' },
    backend: { label: 'Backend', category: 'backend', color: '#6366f1' },
    database: { label: 'Database', category: 'data', color: '#f59e0b' }
  }
  const legacyHit = alias ? legacy[alias] : undefined
  return {
    type,
    label: legacyHit?.label ?? type,
    family: alias ?? 'generic',
    category: legacyHit?.category ?? 'generic',
    color: legacyHit?.color ?? '#94a3b8',
    known: false
  }
}

/** Categoria architetturale suggerita per un type (usata da applyOps e AI). */
export function suggestCategory(type: string): NodeCategory {
  return techInfo(type).category
}

export function isValidCategory(v: string): v is NodeCategory {
  return NODE_CATEGORIES.includes(v as NodeCategory)
}

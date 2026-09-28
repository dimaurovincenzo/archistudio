import { describe, expect, it } from 'vitest'
import { TECH_CATALOG, TECH_BY_TYPE, techInfo, suggestCategory } from '../src/shared/tech'
import { guessCategory } from '../src/main/ops'

describe('catalogo tecnologie', () => {
  it('ha id unici', () => {
    const ids = TECH_CATALOG.map((e) => e.type)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ha voci per tutte le grandi famiglie', () => {
    const types = new Set(TECH_CATALOG.map((e) => e.type))
    for (const expected of [
      'postgresql', 'mysql', 'mongodb', 'redis', 'dynamodb', 'elasticsearch', 'neo4j', 'influxdb',
      'pinecone', 'qdrant', 'rabbitmq', 'kafka', 'nats', 'docker', 'kubernetes', 'nginx',
      'aws', 'gcp', 'azure', 'lambda', 's3', 'nodejs', 'python', 'go', 'rust', 'java', 'php', 'dotnet',
      'react', 'nextjs', 'vue', 'flutter', 'keycloak', 'auth0', 'stripe', 'sendgrid', 'twilio',
      'openai', 'anthropic', 'ollama', 'langchain', 'temporal', 'github-actions', 'terraform',
      'prometheus', 'grafana', 'supabase', 'firebase', 'web-app', 'mobile-app', 'api', 'backend',
      'cron', 'storage', 'external-api', 'ai-service', 'generic'
    ]) {
      expect(types.has(expected), `manca ${expected}`).toBe(true)
    }
  })

  it('usa solo categorie e colori validi', () => {
    for (const e of TECH_CATALOG) {
      expect(e.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(e.category).toBeTruthy()
    }
  })

  it('techInfo risolve le note e degrada con grazia sulle custom', () => {
    const pg = techInfo('postgresql')
    expect(pg.known).toBe(true)
    expect(pg.label).toBe('PostgreSQL')
    expect(pg.family).toBe('db-sql')
    expect(pg.category).toBe('data')

    const custom = techInfo('mia-tecnologia')
    expect(custom.known).toBe(false)
    expect(custom.family).toBe('generic')
    expect(custom.label).toBe('mia-tecnologia')

    // alias legacy del primo MVP
    expect(techInfo('web-app').family).toBe('web')
    expect(techInfo('database').family).toBe('db-sql')
  })

  it('guessCategory deriva dal catalogo', () => {
    expect(guessCategory('postgresql')).toBe('data')
    expect(guessCategory('kafka')).toBe('infrastructure')
    expect(guessCategory('react')).toBe('frontend')
    expect(guessCategory('stripe')).toBe('external')
    expect(guessCategory('openai')).toBe('ai')
    expect(guessCategory('nodejs')).toBe('backend')
    expect(guessCategory('tipo-sconosciuto')).toBe('generic')
  })

  it('la mappa per type è coerente col catalogo', () => {
    expect(TECH_BY_TYPE.size).toBe(TECH_CATALOG.length)
  })

  it('suggestCategory coincide con guessCategory', () => {
    for (const e of TECH_CATALOG.slice(0, 20)) {
      expect(guessCategory(e.type)).toBe(suggestCategory(e.type))
    }
  })
})

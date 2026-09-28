import { randomBytes } from 'node:crypto'

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString('base64url')}`
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'untitled'
  )
}

export function nowIso(): string {
  return new Date().toISOString()
}

import { ProjectStore } from './store'
import { generateArtifactContent } from './templates'
import { ArchiArtifact } from '../shared/types'

/** Thin wrappers so callers get ready-to-insert artifact payloads. */
export const templates = {
  component(store: ProjectStore, nodeId: string): { title: string; category: 'component'; content: string; nodeIds: string[] } {
    const { title, content, nodeIds } = generateArtifactContent(store.model, 'component', { nodeId })
    return { title, category: 'component', content, nodeIds }
  },
  system(store: ProjectStore): { title: string; category: 'system'; content: string; nodeIds: string[] } {
    const { title, content, nodeIds } = generateArtifactContent(store.model, 'system', {})
    return { title, category: 'system', content, nodeIds }
  }
}

export function asArtifactOpPayload(a: ArchiArtifact): ArchiArtifact {
  return a
}

import fs from 'node:fs/promises'
import path from 'node:path'
import { AppSettings, ProjectData, ProjectMeta } from '../shared/types'
import { ProjectStore } from './store'
import { gitCommit } from './versioning'

export class ProjectManager {
  settings: AppSettings
  current: ProjectStore | null = null

  constructor(settings: AppSettings) {
    this.settings = settings
  }

  async ensureRoot(): Promise<void> {
    await fs.mkdir(this.settings.projectsRoot, { recursive: true })
  }

  async listProjects(): Promise<ProjectMeta[]> {
    await this.ensureRoot()
    const entries = await fs.readdir(this.settings.projectsRoot, { withFileTypes: true })
    const out: ProjectMeta[] = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      try {
        const meta = JSON.parse(
          await fs.readFile(path.join(this.settings.projectsRoot, e.name, 'project.json'), 'utf8')
        )
        out.push({ ...meta, path: path.join(this.settings.projectsRoot, e.name) })
      } catch {
        /* not a project */
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async createProject(name: string, description = ''): Promise<ProjectMeta> {
    await this.ensureRoot()
    const store = await ProjectStore.create(this.settings.projectsRoot, name, description)
    await gitCommit(store.dir, `Initial architecture: ${name}`)
    return { ...store.meta, path: store.dir }
  }

  projectDir(id: string): string {
    return path.join(this.settings.projectsRoot, id)
  }

  async openProject(id: string): Promise<ProjectData> {
    const dir = this.projectDir(id)
    const store = await ProjectStore.open(dir)
    this.current = store
    return { meta: store.meta, model: store.model }
  }

  async deleteProject(id: string): Promise<void> {
    if (this.current?.meta.id === id) this.current = null
    await fs.rm(this.projectDir(id), { recursive: true, force: true })
  }

  get store(): ProjectStore {
    if (!this.current) throw new Error('No project is open')
    return this.current
  }
}

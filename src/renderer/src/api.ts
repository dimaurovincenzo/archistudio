import type { ArchiApi } from '../../preload/index'

export const api: ArchiApi = (window as unknown as { archi: ArchiApi }).archi

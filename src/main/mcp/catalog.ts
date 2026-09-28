/** Catalogo dichiarativo di tools e risorse MCP, usato dalla UI delle Impostazioni. */
export const MCP_TOOLS: { name: string; description: string; write?: boolean }[] = [
  { name: 'get_project', description: 'Metadati del progetto e conteggi' },
  { name: 'get_architecture', description: 'Modello completo: componenti, relazioni, gruppi, artefatti' },
  { name: 'get_node', description: 'Dettaglio di un componente con le sue relazioni' },
  { name: 'search_nodes', description: 'Ricerca componenti per nome/tipo/tecnologia/tag' },
  { name: 'get_relationships', description: 'Relazioni, filtrabili per componente o tipo' },
  { name: 'get_artifact', description: 'Contenuto markdown di un artefatto' },
  { name: 'search_artifacts', description: 'Ricerca artefatti per titolo/categoria/contenuto' },
  { name: 'validate_architecture', description: 'Validazione strutturale completa' },
  { name: 'create_node', description: 'Crea un componente', write: true },
  { name: 'update_node', description: 'Aggiorna un componente', write: true },
  { name: 'delete_node', description: 'Elimina un componente (e le sue relazioni)', write: true },
  { name: 'create_relationship', description: 'Collega due componenti (anche per nome)', write: true },
  { name: 'update_relationship', description: 'Aggiorna una relazione', write: true },
  { name: 'delete_relationship', description: 'Elimina una relazione', write: true },
  { name: 'create_artifact', description: 'Crea un artefatto documentale', write: true },
  { name: 'update_artifact', description: 'Aggiorna un artefatto', write: true },
  { name: 'propose_changes', description: 'Propone un batch di modifiche strutturate', write: true },
  { name: 'apply_changes', description: 'Applica una proposta (solo in modalità write)', write: true }
]

export const MCP_RESOURCES: { uri: string; description: string }[] = [
  { uri: 'architecture://project', description: 'Metadati e conteggi del progetto' },
  { uri: 'architecture://nodes', description: 'Tutti i componenti' },
  { uri: 'architecture://relationships', description: 'Tutte le relazioni (con nomi risolti)' },
  { uri: 'architecture://artifacts', description: 'Indice degli artefatti' },
  { uri: 'architecture://decisions', description: 'ADR — architecture decision records' }
]

import { createLocalRepositories } from './localRepositories';
import type { Repositories } from './repositories';
import { createInitialData } from './seed';
import { createBrowserStore } from './storage';

// ÚNICO punto que decide dónde se guardan los datos.
// Para migrar a Supabase: implementar `Repositories` (por ejemplo createSupabaseRepositories)
// y exportarlo acá. Ningún componente cambia.

function createRepositories(): Repositories {
  const { store, persistent } = createBrowserStore();
  return createLocalRepositories(store, persistent, () => createInitialData());
}

export const repositories: Repositories = createRepositories();

export type { Repositories } from './repositories';

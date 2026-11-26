// Único lugar de la app que toca window.localStorage.
// Los repositorios lo usan a través de esta interfaz; para migrar a Supabase
// se reemplazan los repositorios, no los componentes.

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22)
  );
}

/** Almacenamiento en memoria: se usa si el navegador bloquea localStorage. */
export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

class SafeLocalStorage implements KeyValueStore {
  constructor(private readonly storage: Storage) {}

  getItem(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch (error) {
      throw new StorageError('No se pudo leer el almacenamiento del navegador.', { cause: error });
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch (error) {
      if (isQuotaError(error)) {
        throw new StorageError('No hay más espacio disponible en el navegador. Exportá un backup y liberá espacio.', {
          cause: error,
        });
      }
      throw new StorageError('No se pudo guardar en el navegador.', { cause: error });
    }
  }

  removeItem(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch (error) {
      throw new StorageError('No se pudo borrar del almacenamiento del navegador.', { cause: error });
    }
  }
}

/** localStorage si está disponible; si no (modo privado estricto, bloqueado), memoria. */
export function createBrowserStore(): { store: KeyValueStore; persistent: boolean } {
  try {
    const ls = window.localStorage;
    const probe = '__gastos_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { store: new SafeLocalStorage(ls), persistent: true };
  } catch {
    return { store: new MemoryStore(), persistent: false };
  }
}

/** Pide al navegador que no borre los datos ante falta de espacio (si lo soporta). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // Sin soporte: no pasa nada, los datos siguen en localStorage.
  }
  return false;
}

// Preferencia de tema espejada para aplicarla antes del primer render (ver index.html).
const THEME_KEY = 'gastos-tracker:theme';

export function mirrorThemePreference(theme: string): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Si no se puede, el tema se aplica igual apenas carga la app.
  }
}

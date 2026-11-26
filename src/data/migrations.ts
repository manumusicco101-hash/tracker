import type { AppData } from '../types';
import { validateContent, ValidationError } from './validation';

/** Versión actual del esquema. Subirla junto con una migración en MIGRATIONS. */
export const SCHEMA_VERSION = 1;

/**
 * Migraciones: MIGRATIONS[n] convierte datos de la versión n a la n + 1.
 * Ejemplo futuro:
 *   MIGRATIONS[1] = (data) => ({ ...data, schemaVersion: 2, settings: { ...data.settings, nuevoCampo: valorPorDefecto } })
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

/** Lleva cualquier versión anterior a la actual y valida el resultado. */
export function migrate(raw: unknown): AppData {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('Los datos no tienen el formato esperado.');
  }
  let data = raw as Record<string, unknown>;
  let version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ValidationError('Falta la versión del esquema (schemaVersion).');
  }
  if (version > SCHEMA_VERSION) {
    throw new ValidationError(
      `Los datos son de una versión más nueva de la app (esquema ${version}). Actualizá la app para abrirlos.`,
    );
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new ValidationError(`No hay migración desde la versión ${version}.`);
    data = step(data);
    version += 1;
  }
  return { schemaVersion: SCHEMA_VERSION, ...validateContent(data) };
}

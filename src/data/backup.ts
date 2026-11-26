import { localDateFromTimestamp, nowTimestamp } from '../lib/dates';
import type { AppDataContent, BackupFile, ISODate } from '../types';
import { migrate, SCHEMA_VERSION } from './migrations';
import { ValidationError } from './validation';

export const BACKUP_APP_ID = 'gastos-tracker';

export function createBackup(data: AppDataContent, exportedAt: string = nowTimestamp()): BackupFile {
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt, data };
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

/** Valida un archivo de backup (formato, versión y contenido) y lo migra a la versión actual. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ValidationError('El archivo no es un JSON válido.');
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== BACKUP_APP_ID) {
    throw new ValidationError('El archivo no es un backup de esta app.');
  }
  const file = raw as { schemaVersion?: unknown; exportedAt?: unknown; data?: unknown };
  if (typeof file.data !== 'object' || file.data === null) {
    throw new ValidationError('El backup no tiene datos.');
  }
  const migrated = migrate({ ...(file.data as Record<string, unknown>), schemaVersion: file.schemaVersion });
  const { schemaVersion, ...data } = migrated;
  return {
    app: BACKUP_APP_ID,
    schemaVersion,
    exportedAt: typeof file.exportedAt === 'string' && !Number.isNaN(Date.parse(file.exportedAt)) ? file.exportedAt : nowTimestamp(),
    data,
  };
}

export interface BackupSummary {
  expenses: number;
  samples: number;
  categories: number;
  rates: number;
  exportedOn: ISODate;
}

export function summarizeBackup(file: BackupFile): BackupSummary {
  return {
    expenses: file.data.expenses.length,
    samples: file.data.expenses.filter((e) => e.isSample).length,
    categories: file.data.categories.length,
    rates: file.data.settings.rates.length,
    exportedOn: localDateFromTimestamp(file.exportedAt),
  };
}

export function backupFileName(today: ISODate): string {
  return `gastos-backup-${today}.json`;
}

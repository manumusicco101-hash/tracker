import type { AppDataContent, BackupFile, Category, Expense, NewCategory, NewExpense, Settings } from '../types';
import type { RateSnapshotUpdate } from '../lib/rates';

// Contratos de persistencia. Los componentes y el estado global solo conocen estas
// interfaces: para pasar a Supabase alcanza con otra implementación en data/index.ts.
// Todo es asíncrono aunque LocalStorage sea síncrono, justamente por eso.

export interface ExpenseRepository {
  list(): Promise<Expense[]>;
  create(input: NewExpense): Promise<Expense>;
  /** Reemplaza el registro madre (conserva id y createdAt). */
  update(id: string, next: NewExpense): Promise<Expense>;
  /** Devuelve el gasto eliminado (para "Deshacer") o null si no existía. */
  remove(id: string): Promise<Expense | null>;
  /** Vuelve a insertar un gasto eliminado, con su id original. */
  restore(expense: Expense): Promise<void>;
  /** Elimina solo los registros con isSample: true. Devuelve cuántos borró. */
  removeSamples(): Promise<number>;
  /** Pasa todos los gastos de una categoría a otra. Devuelve cuántos movió. */
  reassignCategory(fromId: string, toId: string): Promise<number>;
  /** "Recalcular todo": reemplaza la foto de cotizaciones de cada gasto. */
  applyRateSnapshots(updates: RateSnapshotUpdate[]): Promise<number>;
}

export interface CategoryRepository {
  list(): Promise<Category[]>;
  create(input: NewCategory): Promise<Category>;
  update(id: string, patch: Partial<NewCategory>): Promise<Category>;
  /** Las categorías de sistema ("Otros") no se pueden eliminar. */
  remove(id: string): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
}

export interface BackupRepository {
  exportAll(): Promise<BackupFile>;
  /** Reemplaza todos los datos (gastos, categorías, cotizaciones y ajustes). */
  replaceAll(data: AppDataContent): Promise<void>;
  /** Para recuperar datos que no se pudieron leer: el contenido guardado tal cual. */
  exportRaw(): Promise<string | null>;
  /** Borra todo y vuelve al estado inicial. */
  reset(): Promise<void>;
}

export interface Repositories {
  expenses: ExpenseRepository;
  categories: CategoryRepository;
  settings: SettingsRepository;
  backup: BackupRepository;
  /** false si el navegador no permite guardar (los datos viven solo en memoria). */
  persistent: boolean;
}

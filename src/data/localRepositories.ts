import { nowTimestamp } from '../lib/dates';
import { createId } from '../lib/id';
import type { AppData, AppDataContent, Category, Expense, NewCategory, NewExpense, Settings } from '../types';
import { createBackup } from './backup';
import { migrate, SCHEMA_VERSION } from './migrations';
import type { Repositories } from './repositories';
import { StorageError, type KeyValueStore } from './storage';

export const STORAGE_KEY = 'gastos-tracker:data';

/**
 * Todo el AppData vive en una sola clave: cada escritura es atómica y el backup
 * tiene exactamente la misma forma. Se mantiene una copia en memoria para leer rápido.
 */
class LocalDatabase {
  private cache: AppData | null = null;

  constructor(
    private readonly store: KeyValueStore,
    private readonly seed: () => AppData,
  ) {}

  read(): AppData {
    if (this.cache) return this.cache;
    const raw = this.store.getItem(STORAGE_KEY);
    if (raw === null) {
      const initial = this.seed();
      this.persist(initial);
      this.cache = initial;
      return initial;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new StorageError('Los datos guardados están dañados y no se pueden leer.', { cause: error });
    }
    this.cache = migrate(parsed);
    return this.cache;
  }

  /** Aplica un cambio y lo guarda. Si falla el guardado, la copia en memoria no cambia. */
  write<T>(mutate: (data: AppData) => { data: AppData; result: T }): T {
    const { data, result } = mutate(this.read());
    this.persist(data);
    this.cache = data;
    return result;
  }

  raw(): string | null {
    return this.store.getItem(STORAGE_KEY);
  }

  reset(): void {
    this.store.removeItem(STORAGE_KEY);
    this.cache = null;
  }

  private persist(data: AppData): void {
    this.store.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

function notFound(what: string, id: string): never {
  throw new Error(`No se encontró ${what} (${id}).`);
}

export function createLocalRepositories(store: KeyValueStore, persistent: boolean, seed: () => AppData): Repositories {
  const db = new LocalDatabase(store, seed);

  return {
    persistent,

    expenses: {
      async list() {
        return db.read().expenses;
      },

      async create(input: NewExpense) {
        const now = nowTimestamp();
        const expense = { ...input, id: createId(), createdAt: now, updatedAt: now } as Expense;
        return db.write((data) => ({ data: { ...data, expenses: [...data.expenses, expense] }, result: expense }));
      },

      async update(id: string, next: NewExpense) {
        return db.write((data) => {
          const current = data.expenses.find((e) => e.id === id) ?? notFound('el gasto', id);
          const updated = { ...next, id, createdAt: current.createdAt, updatedAt: nowTimestamp() } as Expense;
          return { data: { ...data, expenses: data.expenses.map((e) => (e.id === id ? updated : e)) }, result: updated };
        });
      },

      async remove(id: string) {
        return db.write((data) => {
          const removed = data.expenses.find((e) => e.id === id) ?? null;
          return { data: { ...data, expenses: data.expenses.filter((e) => e.id !== id) }, result: removed };
        });
      },

      async restore(expense: Expense) {
        db.write((data) => {
          if (data.expenses.some((e) => e.id === expense.id)) return { data, result: undefined };
          return { data: { ...data, expenses: [...data.expenses, expense] }, result: undefined };
        });
      },

      async removeSamples() {
        return db.write((data) => {
          const kept = data.expenses.filter((e) => !e.isSample);
          return { data: { ...data, expenses: kept }, result: data.expenses.length - kept.length };
        });
      },

      async reassignCategory(fromId: string, toId: string) {
        return db.write((data) => {
          let moved = 0;
          const now = nowTimestamp();
          const expenses = data.expenses.map((e) => {
            if (e.categoryId !== fromId) return e;
            moved += 1;
            return { ...e, categoryId: toId, updatedAt: now };
          });
          return { data: { ...data, expenses }, result: moved };
        });
      },

      async applyRateSnapshots(updates) {
        return db.write((data) => {
          const byId = new Map(updates.map((u) => [u.id, u]));
          const now = nowTimestamp();
          let changed = 0;
          const expenses = data.expenses.map((e) => {
            const u = byId.get(e.id);
            if (!u) return e;
            changed += 1;
            const { rateId: _oldId, rateLabel: _oldLabel, ...rest } = e;
            return {
              ...rest,
              rateAtCreation: u.rateAtCreation,
              ...(u.rateId ? { rateId: u.rateId } : {}),
              ...(u.rateLabel ? { rateLabel: u.rateLabel } : {}),
              updatedAt: now,
            } as Expense;
          });
          return { data: { ...data, expenses }, result: changed };
        });
      },
    },

    categories: {
      async list() {
        return [...db.read().categories].sort((a, b) => a.order - b.order);
      },

      async create(input: NewCategory) {
        const category: Category = { ...input, id: createId() };
        delete category.isSystem;
        return db.write((data) => ({ data: { ...data, categories: [...data.categories, category] }, result: category }));
      },

      async update(id: string, patch: Partial<NewCategory>) {
        return db.write((data) => {
          const current = data.categories.find((c) => c.id === id) ?? notFound('la categoría', id);
          const updated: Category = { ...current, ...patch, id };
          if (current.isSystem) updated.isSystem = true;
          else delete updated.isSystem;
          return { data: { ...data, categories: data.categories.map((c) => (c.id === id ? updated : c)) }, result: updated };
        });
      },

      async remove(id: string) {
        db.write((data) => {
          const current = data.categories.find((c) => c.id === id) ?? notFound('la categoría', id);
          if (current.isSystem) throw new Error(`La categoría "${current.name}" no se puede eliminar.`);
          if (data.expenses.some((e) => e.categoryId === id)) {
            throw new Error('Primero hay que reasignar los gastos de esta categoría.');
          }
          return { data: { ...data, categories: data.categories.filter((c) => c.id !== id) }, result: undefined };
        });
      },
    },

    settings: {
      async get() {
        return db.read().settings;
      },

      async update(patch: Partial<Settings>) {
        return db.write((data) => {
          const settings = { ...data.settings, ...patch };
          return { data: { ...data, settings }, result: settings };
        });
      },
    },

    backup: {
      async exportAll() {
        const { schemaVersion: _version, ...content } = db.read();
        return createBackup(content);
      },

      async replaceAll(content: AppDataContent) {
        const validated = migrate({ ...content, schemaVersion: SCHEMA_VERSION });
        db.write(() => ({ data: validated, result: undefined }));
      },

      async exportRaw() {
        return db.raw();
      },

      async reset() {
        db.reset();
      },
    },
  };
}

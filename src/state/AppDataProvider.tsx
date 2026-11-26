import { Database, RotateCcw } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { OTHER_CATEGORY_ID } from '../data/defaults';
import { repositories } from '../data';
import { requestPersistentStorage } from '../data/storage';
import { currentRateTable, findRate } from '../lib/currency';
import { toNewExpense } from '../lib/expenses';
import { deleteRate, rebaseExpenseRates, setDefaultRate, upsertRate, type RateInput } from '../lib/rates';
import { planPriceChange } from '../lib/recurring';
import { useToday } from '../hooks/useToday';
import { downloadTextFile, errorMessage } from '../utils/download';
import type { BackupFile, Category, Expense, ISODate, NewCategory, NewExpense, PaymentMethod, Settings } from '../types';

// Estado global de la app. Solo habla con `repositories` (la capa de persistencia):
// ningún componente toca localStorage.

interface Snapshot {
  expenses: Expense[];
  categories: Category[];
  settings: Settings;
}

type Status = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: Snapshot };

export interface AppActions {
  addExpense(input: NewExpense): Promise<Expense>;
  updateExpense(id: string, input: NewExpense): Promise<Expense>;
  deleteExpense(id: string): Promise<Expense | null>;
  restoreExpense(expense: Expense): Promise<void>;
  cancelRecurring(id: string): Promise<void>;
  /** Cambio de precio desde la próxima ocurrencia. 'split' = se cerró la serie y se creó otra. */
  changeRecurringAmount(id: string, amountCents: number): Promise<'split' | 'updated'>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  rememberQuickAdd(categoryId: string, paymentMethod: PaymentMethod): Promise<void>;
  saveRate(input: RateInput): Promise<void>;
  removeRate(id: string): Promise<void>;
  makeDefaultRate(id: string): Promise<void>;
  /** Devuelve una copia previa para poder deshacer. */
  recalculateAllRates(): Promise<BackupFile>;
  saveCategory(input: NewCategory, id?: string): Promise<Category>;
  /** Devuelve cuántos gastos pasaron a "Otros". */
  deleteCategory(id: string): Promise<number>;
  removeSampleData(): Promise<number>;
  exportBackup(): Promise<BackupFile>;
  importBackup(file: BackupFile): Promise<void>;
}

export interface AppDataContextValue extends Snapshot {
  today: ISODate;
  persistent: boolean;
  categoryById: Map<string, Category>;
  expenseById: Map<string, Expense>;
  categoryName: (id: string) => string;
  actions: AppActions;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

async function loadSnapshot(): Promise<Snapshot> {
  const [expenses, categories, settings] = await Promise.all([
    repositories.expenses.list(),
    repositories.categories.list(),
    repositories.settings.get(),
  ]);
  return { expenses, categories, settings };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const today = useToday();

  const refresh = useCallback(async () => {
    const data = await loadSnapshot();
    setStatus({ kind: 'ready', data });
  }, []);

  useEffect(() => {
    refresh().catch((error: unknown) => setStatus({ kind: 'error', message: errorMessage(error) }));
    if (repositories.persistent) void requestPersistentStorage();
  }, [refresh]);

  const data = status.kind === 'ready' ? status.data : null;

  const actions = useMemo<AppActions | null>(() => {
    if (!data) return null;
    const { expenses, settings } = data;

    async function mutate<T>(fn: () => Promise<T>): Promise<T> {
      try {
        return await fn();
      } finally {
        await refresh();
      }
    }

    const findExpense = (id: string): Expense => {
      const e = expenses.find((x) => x.id === id);
      if (!e) throw new Error('El gasto ya no existe.');
      return e;
    };

    return {
      addExpense: (input) => mutate(() => repositories.expenses.create(input)),

      updateExpense: (id, input) => mutate(() => repositories.expenses.update(id, input)),

      deleteExpense: (id) => mutate(() => repositories.expenses.remove(id)),

      restoreExpense: (expense) => mutate(() => repositories.expenses.restore(expense)),

      cancelRecurring: (id) =>
        mutate(async () => {
          const e = findExpense(id);
          if (e.kind !== 'recurring') return;
          await repositories.expenses.update(id, { ...toNewExpense(e), kind: 'recurring', recurrence: { ...e.recurrence, endedOn: today } });
        }),

      changeRecurringAmount: (id, amountCents) =>
        mutate(async () => {
          const e = findExpense(id);
          if (e.kind !== 'recurring') throw new Error('Solo se puede cambiar el monto de un gasto recurrente.');
          const plan = planPriceChange(e, today);
          if (!plan) {
            await repositories.expenses.update(id, { ...toNewExpense(e), kind: 'recurring', amountCents });
            return 'updated' as const;
          }
          await repositories.expenses.update(id, {
            ...toNewExpense(e),
            kind: 'recurring',
            recurrence: { ...e.recurrence, endedOn: plan.endedOn },
          });
          const chosen = findRate(settings.rates, e.rateId);
          const { rateId: _rateId, rateLabel: _rateLabel, ...rest } = toNewExpense(e);
          await repositories.expenses.create({
            ...rest,
            kind: 'recurring',
            amountCents,
            date: plan.startDate,
            rateAtCreation: currentRateTable(settings.rates, e.currency, chosen?.id),
            ...(chosen ? { rateId: chosen.id, ...(chosen.label ? { rateLabel: chosen.label } : {}) } : {}),
            recurrence: { frequency: 'monthly', dayOfMonth: e.recurrence.dayOfMonth, endedOn: null, replacesId: e.id },
          });
          return 'split' as const;
        }),

      updateSettings: (patch) => mutate(async () => void (await repositories.settings.update(patch))),

      rememberQuickAdd: (categoryId, paymentMethod) =>
        mutate(async () => {
          if (settings.quickAdd.lastCategoryId === categoryId && settings.quickAdd.lastPaymentMethod === paymentMethod) return;
          await repositories.settings.update({ quickAdd: { lastCategoryId: categoryId, lastPaymentMethod: paymentMethod } });
        }),

      saveRate: (input) =>
        mutate(async () => {
          const next = upsertRate(settings, input, today);
          await repositories.settings.update({ rates: next.rates, rateHistory: next.rateHistory });
        }),

      removeRate: (id) =>
        mutate(async () => {
          const next = deleteRate(settings, id);
          await repositories.settings.update({ rates: next.rates });
        }),

      makeDefaultRate: (id) =>
        mutate(async () => {
          const next = setDefaultRate(settings, id);
          await repositories.settings.update({ rates: next.rates });
        }),

      recalculateAllRates: () =>
        mutate(async () => {
          const before = await repositories.backup.exportAll();
          await repositories.expenses.applyRateSnapshots(rebaseExpenseRates(expenses, settings.rates));
          // Sin historial, los recurrentes también pasan a usar la cotización actual.
          await repositories.settings.update({ rateHistory: [] });
          return before;
        }),

      saveCategory: (input, id) =>
        mutate(() => (id ? repositories.categories.update(id, input) : repositories.categories.create(input))),

      deleteCategory: (id) =>
        mutate(async () => {
          const moved = await repositories.expenses.reassignCategory(id, OTHER_CATEGORY_ID);
          await repositories.categories.remove(id);
          if (settings.quickAdd.lastCategoryId === id) {
            await repositories.settings.update({ quickAdd: { ...settings.quickAdd, lastCategoryId: OTHER_CATEGORY_ID } });
          }
          return moved;
        }),

      removeSampleData: () => mutate(() => repositories.expenses.removeSamples()),

      exportBackup: () => repositories.backup.exportAll(),

      importBackup: (file) => mutate(() => repositories.backup.replaceAll(file.data)),
    };
  }, [data, refresh, today]);

  const value = useMemo<AppDataContextValue | null>(() => {
    if (!data || !actions) return null;
    const categoryById = new Map(data.categories.map((c) => [c.id, c]));
    return {
      ...data,
      today,
      persistent: repositories.persistent,
      categoryById,
      expenseById: new Map(data.expenses.map((e) => [e.id, e])),
      categoryName: (id: string) => categoryById.get(id)?.name ?? 'Otros',
      actions,
    };
  }, [data, actions, today]);

  if (status.kind === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400" />
      </div>
    );
  }

  if (status.kind === 'error' || !value) {
    return <LoadError message={status.kind === 'error' ? status.message : 'No se pudieron cargar los datos.'} />;
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

function LoadError({ message }: { message: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <span className="grid size-12 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
        <Database className="size-6" aria-hidden />
      </span>
      <div>
        <h1 className="text-xl font-semibold">No pudimos leer tus datos</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Podés descargar lo que está guardado para no perderlo y, si querés, empezar de cero.
        </p>
      </div>
      <Button
        variant="secondary"
        onClick={async () => {
          const raw = await repositories.backup.exportRaw();
          downloadTextFile('gastos-datos-guardados.txt', raw ?? '', 'text/plain;charset=utf-8');
        }}
      >
        Descargar datos guardados
      </Button>
      {confirming ? (
        <Button
          variant="danger"
          onClick={async () => {
            await repositories.backup.reset();
            window.location.reload();
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Sí, borrar todo y empezar de cero
        </Button>
      ) : (
        <Button variant="danger-soft" onClick={() => setConfirming(true)}>
          Empezar de cero
        </Button>
      )}
    </div>
  );
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData tiene que usarse dentro de <AppDataProvider>.');
  return ctx;
}

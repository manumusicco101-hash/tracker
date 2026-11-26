import { createContext, useContext } from 'react';
import type { TabId } from '../hooks/useHashRoute';
import type { Expense, Occurrence } from '../types';

/** Acciones de interfaz disponibles en toda la app (abrir paneles, navegar). */
export interface UIContextValue {
  /** Abre el Quick Add. Llamarlo dentro del handler del toque para que el teclado se abra en iOS. */
  openQuickAdd: () => void;
  openEditExpense: (expense: Expense) => void;
  /** Detalle del registro madre de una ocurrencia (cuota, recurrente o único). */
  openExpenseDetail: (expenseId: string, occurrence?: Occurrence) => void;
  navigate: (tab: TabId) => void;
}

export const UIContext = createContext<UIContextValue | null>(null);

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI tiene que usarse dentro de <UIContext.Provider>.');
  return ctx;
}

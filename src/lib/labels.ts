import type { ExpenseKind, PaymentMethod, ThemePreference } from '../types';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'debit', 'credit', 'transfer'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  transfer: 'Transferencia',
};

export const EXPENSE_KINDS: ExpenseKind[] = ['single', 'installments', 'recurring'];

export const KIND_LABELS: Record<ExpenseKind, string> = {
  single: 'Pago único',
  installments: 'En cuotas',
  recurring: 'Recurrente',
};

/** Etiquetas cortas para filtros y CSV. */
export const KIND_SHORT_LABELS: Record<ExpenseKind, string> = {
  single: 'Único',
  installments: 'Cuota',
  recurring: 'Recurrente',
};

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

export const RATE_LABEL_SUGGESTIONS = ['Oficial', 'MEP', 'Tarjeta', 'Blue'];

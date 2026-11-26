// ─────────────────────────────────────────────────────────────
// Primitivos
// ─────────────────────────────────────────────────────────────

/** Fecha local 'YYYY-MM-DD'. Se parsea a mano: nunca pasar por new Date(string). */
export type ISODate = string;
/** Mes 'YYYY-MM'. */
export type YearMonth = string;
/** Timestamp ISO completo. Solo auditoría y orden; nunca para agrupar por día. */
export type Timestamp = string;

export type CurrencyCode = 'ARS' | 'USD' | 'EUR';
export type ForeignCurrency = Exclude<CurrencyCode, 'ARS'>;
export type BaseCurrency = 'ARS' | 'USD';
export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer';
export type ThemePreference = 'system' | 'light' | 'dark';

/** Cuántos ARS vale 1 unidad de cada moneda. ARS es el pivote: siempre 1. */
export type RateTable = Record<CurrencyCode, number>;

/** Monto con su moneda (presupuestos). Se convierte a la base al mostrarse. */
export interface Budget {
  amountCents: number;
  currency: BaseCurrency;
}

// ─────────────────────────────────────────────────────────────
// Cotizaciones
// ─────────────────────────────────────────────────────────────

export interface ExchangeRate {
  id: string;
  currency: ForeignCurrency;
  /** Etiqueta opcional: 'Oficial', 'MEP', 'Tarjeta' o libre. '' = sin etiqueta. */
  label: string;
  /** ARS por 1 unidad de `currency`. */
  arsPerUnit: number;
  /** Cotización por defecto de su moneda (exactamente una por moneda). */
  isDefault: boolean;
  updatedAt: Timestamp;
}

/** Cada cambio de valor de una cotización queda registrado con su fecha. */
export interface RateHistoryEntry {
  rateId: string;
  date: ISODate;
  arsPerUnit: number;
}

// ─────────────────────────────────────────────────────────────
// Categorías
// ─────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  /** Clave del mapa CATEGORY_ICONS (íconos de Lucide). */
  icon: string;
  /** Color hex de la paleta. */
  color: string;
  order: number;
  /** Presupuesto mensual opcional. */
  budget: Budget | null;
  /** 'Otros' es de sistema: no se puede eliminar (recibe los gastos reasignados). */
  isSystem?: true;
}

// ─────────────────────────────────────────────────────────────
// Gastos: un único registro madre por compra
// ─────────────────────────────────────────────────────────────

interface ExpenseBase {
  id: string;
  /** Entero, en `currency`. En cuotas es el precio de contado. */
  amountCents: number;
  currency: CurrencyCode;
  /** Foto de las cotizaciones al cargarlo (la de su moneda = la elegida). */
  rateAtCreation: RateTable;
  /** Cotización elegida al cargarlo (solo moneda extranjera). */
  rateId?: string;
  /** Etiqueta de esa cotización al momento de cargarlo. */
  rateLabel?: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  /** Fecha de compra o de inicio de la serie. */
  date: ISODate;
  /** Nota / descripción opcional. */
  note?: string;
  isSample?: true;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SingleExpense extends ExpenseBase {
  kind: 'single';
}

export interface InstallmentPlan {
  /** Cantidad de cuotas (≥ 2). */
  count: number;
  interest: 'none' | 'financed';
  /** Total a pagar. Igual a amountCents si es sin interés. */
  financedTotalCents: number;
  firstDue: 'this_month' | 'next_month';
}

export interface InstallmentExpense extends ExpenseBase {
  kind: 'installments';
  paymentMethod: 'credit';
  installments: InstallmentPlan;
}

export interface Recurrence {
  frequency: 'monthly';
  /** 1–31. Se fija al crear; cada mes se calcula desde acá (nunca se corre). */
  dayOfMonth: number;
  /** null = activa. Si no, fecha de cancelación (las ocurrencias ≤ endedOn se conservan). */
  endedOn: ISODate | null;
  /** Serie anterior, si esta nació de un cambio de precio. */
  replacesId?: string;
}

export interface RecurringExpense extends ExpenseBase {
  kind: 'recurring';
  recurrence: Recurrence;
}

export type Expense = SingleExpense | InstallmentExpense | RecurringExpense;
export type ExpenseKind = Expense['kind'];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Lo que se le pasa al repositorio para crear o reemplazar un gasto. */
export type NewExpense = DistributiveOmit<Expense, 'id' | 'createdAt' | 'updatedAt'>;
export type NewCategory = Omit<Category, 'id'>;

// ─────────────────────────────────────────────────────────────
// Ocurrencias: se CALCULAN a partir de los registros madre, nunca se guardan
// ─────────────────────────────────────────────────────────────

export interface Occurrence {
  /** Estable para React. */
  key: string;
  expenseId: string;
  kind: ExpenseKind;
  /** Fecha efectiva de esta cuota / ocurrencia. */
  date: ISODate;
  /** En la moneda original. */
  amountCents: number;
  currency: CurrencyCode;
  /** Cotizaciones usadas para convertir esta ocurrencia. */
  rates: RateTable;
  /** En moneda base, sin redondear (se redondea al mostrar). */
  amountBase: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note?: string;
  rateLabel?: string;
  isSample: boolean;
  /** Solo en cuotas. 1-based: "Cuota 2/6". */
  installment?: { number: number; count: number };
  /**
   * false solo en la fila informativa de una compra en cuotas cuya
   * primera cuota cae el mes siguiente (se ve el día de la compra, no suma).
   */
  countsInTotals: boolean;
  /** Para ordenar dentro del mismo día. */
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────
// Ajustes y persistencia
// ─────────────────────────────────────────────────────────────

export interface Settings {
  baseCurrency: BaseCurrency;
  /** Cotizaciones vigentes: solo las usan los gastos nuevos. */
  rates: ExchangeRate[];
  /** Historial de valores: lo usan las ocurrencias recurrentes. */
  rateHistory: RateHistoryEntry[];
  /** Presupuesto mensual global (obligatorio). */
  budget: Budget;
  quickAdd: {
    lastCategoryId: string | null;
    lastPaymentMethod: PaymentMethod;
  };
  theme: ThemePreference;
}

export interface AppData {
  schemaVersion: number;
  expenses: Expense[];
  categories: Category[];
  settings: Settings;
}

export type AppDataContent = Omit<AppData, 'schemaVersion'>;

export interface BackupFile {
  app: 'gastos-tracker';
  schemaVersion: number;
  exportedAt: Timestamp;
  data: AppDataContent;
}

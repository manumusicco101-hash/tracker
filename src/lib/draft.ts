import type {
  Category,
  CurrencyCode,
  Expense,
  ExpenseKind,
  ISODate,
  InstallmentPlan,
  NewExpense,
  PaymentMethod,
  RateTable,
  Settings,
} from '../types';
import { currentRateTable, defaultRate, findRate, isForeign } from './currency';
import { isValidISODate, parseISODate } from './dates';
import { INSTALLMENT_PRESETS, MAX_INSTALLMENTS, splitInstallments } from './installments';
import { centsToInputText, parseAmountInput } from './money';

// Estado del formulario de Quick Add / edición y su conversión a un registro madre.

export interface ExpenseDraft {
  amountText: string;
  currency: CurrencyCode;
  /** Cotización elegida (solo moneda extranjera). */
  rateId: string | null;
  categoryId: string;
  paymentMethod: PaymentMethod;
  date: ISODate;
  note: string;
  mode: ExpenseKind;
  installmentCount: number;
  useCustomCount: boolean;
  customCountText: string;
  interest: InstallmentPlan['interest'];
  financedText: string;
  firstDue: InstallmentPlan['firstDue'];
}

export interface DraftErrors {
  amount?: string;
  date?: string;
  category?: string;
  installments?: string;
  financed?: string;
}

export type DraftResult = { ok: true; expense: NewExpense } | { ok: false; errors: DraftErrors };

/** Categoría por defecto: la última usada si existe; si no, la primera. */
export function defaultCategoryId(settings: Settings, categories: Category[]): string {
  const last = settings.quickAdd.lastCategoryId;
  if (last && categories.some((c) => c.id === last)) return last;
  return [...categories].sort((a, b) => a.order - b.order)[0]?.id ?? '';
}

/** Borrador nuevo: todo precargado para que alcance con escribir el monto y guardar. */
export function createDraft(settings: Settings, categories: Category[], today: ISODate): ExpenseDraft {
  const currency = settings.baseCurrency;
  return {
    amountText: '',
    currency,
    rateId: isForeign(currency) ? (defaultRate(settings.rates, currency)?.id ?? null) : null,
    categoryId: defaultCategoryId(settings, categories),
    paymentMethod: settings.quickAdd.lastPaymentMethod,
    date: today,
    note: '',
    mode: 'single',
    installmentCount: 3,
    useCustomCount: false,
    customCountText: '',
    interest: 'none',
    financedText: '',
    firstDue: 'next_month',
  };
}

/** Borrador a partir de un registro madre existente (para editar). */
export function draftFromExpense(e: Expense): ExpenseDraft {
  const base: ExpenseDraft = {
    amountText: centsToInputText(e.amountCents),
    currency: e.currency,
    rateId: e.rateId ?? null,
    categoryId: e.categoryId,
    paymentMethod: e.paymentMethod,
    date: e.date,
    note: e.note ?? '',
    mode: e.kind,
    installmentCount: 3,
    useCustomCount: false,
    customCountText: '',
    interest: 'none',
    financedText: '',
    firstDue: 'next_month',
  };
  if (e.kind === 'installments') {
    const { count, interest, financedTotalCents, firstDue } = e.installments;
    const isPreset = (INSTALLMENT_PRESETS as readonly number[]).includes(count);
    base.installmentCount = isPreset ? count : 3;
    base.useCustomCount = !isPreset;
    base.customCountText = isPreset ? '' : String(count);
    base.interest = interest;
    base.financedText = interest === 'financed' ? centsToInputText(financedTotalCents) : '';
    base.firstDue = firstDue;
  }
  return base;
}

/** Cantidad de cuotas efectiva (preset o personalizada), o null si es inválida. */
export function effectiveInstallmentCount(draft: ExpenseDraft): number | null {
  if (!draft.useCustomCount) return draft.installmentCount;
  const n = Number(draft.customCountText.trim());
  return Number.isInteger(n) && n >= 2 && n <= MAX_INSTALLMENTS ? n : null;
}

/** Cuotas calculadas para la vista previa, o null si faltan datos. */
export function previewInstallments(draft: ExpenseDraft): number[] | null {
  const count = effectiveInstallmentCount(draft);
  const amount = parseAmountInput(draft.amountText);
  if (count === null || amount === null || amount <= 0) return null;
  const total = draft.interest === 'financed' ? parseAmountInput(draft.financedText) : amount;
  if (total === null || total <= 0) return null;
  return splitInstallments(total, count);
}

interface RateSnapshot {
  rateAtCreation: RateTable;
  rateId?: string;
  rateLabel?: string;
}

/**
 * Cotización a guardar: si se edita un gasto sin cambiar moneda ni cotización elegida,
 * se conserva la foto original. Si no, se toma la cotización vigente.
 */
function resolveRates(draft: ExpenseDraft, settings: Settings, original?: Expense): RateSnapshot {
  if (original && original.currency === draft.currency && (original.rateId ?? null) === (draft.rateId ?? null)) {
    const kept: RateSnapshot = { rateAtCreation: original.rateAtCreation };
    if (original.rateId) kept.rateId = original.rateId;
    if (original.rateLabel) kept.rateLabel = original.rateLabel;
    return kept;
  }
  const chosen = isForeign(draft.currency)
    ? (findRate(settings.rates, draft.rateId) ?? defaultRate(settings.rates, draft.currency))
    : undefined;
  const snapshot: RateSnapshot = { rateAtCreation: currentRateTable(settings.rates, draft.currency, chosen?.id) };
  if (chosen) {
    snapshot.rateId = chosen.id;
    if (chosen.label) snapshot.rateLabel = chosen.label;
  }
  return snapshot;
}

/** Valida el borrador y lo convierte en un registro madre listo para guardar. */
export function buildExpenseFromDraft(
  draft: ExpenseDraft,
  settings: Settings,
  categories: Category[],
  original?: Expense,
): DraftResult {
  const errors: DraftErrors = {};

  const amountCents = parseAmountInput(draft.amountText);
  if (amountCents === null || amountCents <= 0) errors.amount = 'Ingresá un monto mayor a cero.';
  if (!isValidISODate(draft.date)) errors.date = 'Elegí una fecha válida.';
  if (!categories.some((c) => c.id === draft.categoryId)) errors.category = 'Elegí una categoría.';

  let plan: InstallmentPlan | null = null;
  if (draft.mode === 'installments') {
    const count = effectiveInstallmentCount(draft);
    if (draft.paymentMethod !== 'credit') {
      errors.installments = 'Las cuotas solo están disponibles con tarjeta de crédito.';
    } else if (count === null) {
      errors.installments = `Ingresá entre 2 y ${MAX_INSTALLMENTS} cuotas.`;
    }
    let financedTotalCents = amountCents ?? 0;
    if (draft.interest === 'financed') {
      const financed = parseAmountInput(draft.financedText);
      if (financed === null || financed <= 0) {
        errors.financed = 'Ingresá el total financiado.';
      } else if (amountCents !== null && financed < amountCents) {
        errors.financed = 'El total financiado no puede ser menor al precio.';
      } else {
        financedTotalCents = financed;
      }
    }
    if (count !== null) {
      plan = { count, interest: draft.interest, financedTotalCents, firstDue: draft.firstDue };
    }
  }

  if (Object.keys(errors).length > 0 || amountCents === null) return { ok: false, errors };

  const common = {
    amountCents,
    currency: draft.currency,
    ...resolveRates(draft, settings, original),
    categoryId: draft.categoryId,
    date: draft.date,
    ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
    ...(original?.isSample ? { isSample: true as const } : {}),
  };

  switch (draft.mode) {
    case 'single':
      return { ok: true, expense: { ...common, kind: 'single', paymentMethod: draft.paymentMethod } };
    case 'installments':
      if (!plan) return { ok: false, errors: { installments: 'Revisá las cuotas.' } };
      return { ok: true, expense: { ...common, kind: 'installments', paymentMethod: 'credit', installments: plan } };
    case 'recurring': {
      const previous = original?.kind === 'recurring' ? original.recurrence : null;
      return {
        ok: true,
        expense: {
          ...common,
          kind: 'recurring',
          paymentMethod: draft.paymentMethod,
          recurrence: {
            frequency: 'monthly',
            dayOfMonth: parseISODate(draft.date).d,
            endedOn: previous?.endedOn ?? null,
            ...(previous?.replacesId ? { replacesId: previous.replacesId } : {}),
          },
        },
      };
    }
  }
}

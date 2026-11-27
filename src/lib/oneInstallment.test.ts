import { describe, expect, it } from 'vitest';
import type { Category } from '../types';
import { realizedInMonth, sumBase } from './aggregations';
import { buildExpenseFromDraft, createDraft, draftFromExpense } from './draft';
import { describeSplit, INSTALLMENT_PRESETS, installmentCountLabel, installmentProgress, splitInstallments } from './installments';
import { expandOccurrences } from './occurrences';
import { installments, makeSettings } from './testing';

// Pagar con crédito en 1 cuota: un solo pago con la tarjeta, que suma en el mes en que se paga.

const settings = makeSettings();
const categories: Category[] = [
  { id: 'alimentacion', name: 'Alimentación', icon: 'utensils', color: '#f97316', order: 0, budget: null },
  { id: 'otros', name: 'Otros', icon: 'ellipsis', color: '#71717a', order: 8, budget: null, isSystem: true },
];

const oneNextMonth = () =>
  installments({
    id: 'una-cuota',
    date: '2026-11-20',
    amountCents: 50_000_00,
    installments: { count: 1, interest: 'none', financedTotalCents: 50_000_00, firstDue: 'next_month' },
  });

describe('1 cuota con crédito', () => {
  it('es la primera opción de cantidad de cuotas', () => {
    expect(INSTALLMENT_PRESETS[0]).toBe(1);
  });

  it('el formulario la acepta y guarda una compra en 1 cuota', () => {
    const draft = {
      ...createDraft(settings, categories, '2026-11-20'),
      amountText: '50.000',
      paymentMethod: 'credit' as const,
      mode: 'installments' as const,
      installmentCount: 1,
      firstDue: 'next_month' as const,
    };
    const result = buildExpenseFromDraft(draft, settings, categories);
    expect(result.ok).toBe(true);
    if (result.ok && result.expense.kind === 'installments') {
      expect(result.expense.installments).toEqual({ count: 1, interest: 'none', financedTotalCents: 50_000_00, firstDue: 'next_month' });
    }
  });

  it('al editarla se reconoce como la opción "1", no como cantidad personalizada', () => {
    const draft = draftFromExpense(oneNextMonth());
    expect(draft).toMatchObject({ mode: 'installments', installmentCount: 1, useCustomCount: false });
  });

  it('una sola cuota con el total completo', () => {
    expect(splitInstallments(50_000_00, 1)).toEqual([50_000_00]);
    expect(describeSplit([50_000_00], (c) => String(c / 100))).toBe('1 cuota de 50000');
    expect(installmentCountLabel(1)).toBe('1 cuota');
    expect(installmentCountLabel(6)).toBe('6 cuotas');
  });

  it('pagada el mes siguiente: suma en ese mes y el día de la compra queda la fila informativa', () => {
    const occs = expandOccurrences([oneNextMonth()], '2026-11-01', '2026-12-31', settings);
    expect(occs).toHaveLength(2);
    const marker = occs.find((o) => !o.countsInTotals);
    expect(marker?.date).toBe('2026-11-20');
    const payment = occs.find((o) => o.installment);
    expect(payment).toMatchObject({ date: '2026-12-20', amountCents: 50_000_00, installment: { number: 1, count: 1 }, countsInTotals: true });
    expect(sumBase(realizedInMonth(occs, '2026-11', '2026-11-26'))).toBe(0);
    expect(sumBase(realizedInMonth(occs, '2026-12', '2026-12-31'))).toBe(50_000);
  });

  it('pagada este mes: suma el mismo día de la compra, sin fila informativa', () => {
    const e = installments({
      id: 'una-cuota-hoy',
      date: '2026-11-20',
      amountCents: 50_000_00,
      installments: { count: 1, interest: 'none', financedTotalCents: 50_000_00, firstDue: 'this_month' },
    });
    const occs = expandOccurrences([e], '2026-11-01', '2026-12-31', settings);
    expect(occs).toHaveLength(1);
    expect(occs[0]).toMatchObject({ date: '2026-11-20', countsInTotals: true });
    expect(sumBase(occs)).toBe(50_000);
  });

  it('el progreso muestra cuándo se paga y queda terminada al pagarse', () => {
    expect(installmentProgress(oneNextMonth(), '2026-11-26')).toMatchObject({ count: 1, paidCount: 0, nextDate: '2026-12-20', isFinished: false });
    expect(installmentProgress(oneNextMonth(), '2026-12-20')).toMatchObject({ paidCount: 1, nextDate: null, isFinished: true });
  });
});

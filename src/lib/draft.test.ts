import { describe, expect, it } from 'vitest';
import type { Category } from '../types';
import { buildExpenseFromDraft, createDraft, draftFromExpense, previewInstallments } from './draft';
import { installments, makeSettings, recurring, single } from './testing';

const categories: Category[] = [
  { id: 'alimentacion', name: 'Alimentación', icon: 'utensils', color: '#f97316', order: 0, budget: null },
  { id: 'otros', name: 'Otros', icon: 'ellipsis', color: '#71717a', order: 8, budget: null, isSystem: true },
];

describe('Quick Add: borrador precargado', () => {
  it('usa la última categoría y método, moneda base, hoy y pago único', () => {
    const settings = makeSettings({ quickAdd: { lastCategoryId: 'otros', lastPaymentMethod: 'cash', openOnLaunch: false } });
    const d = createDraft(settings, categories, '2026-11-25');
    expect(d).toMatchObject({ categoryId: 'otros', paymentMethod: 'cash', currency: 'ARS', date: '2026-11-25', mode: 'single' });
  });

  it('con solo el monto ya se puede guardar', () => {
    const settings = makeSettings();
    const d = { ...createDraft(settings, categories, '2026-11-25'), amountText: '1.234,56' };
    const r = buildExpenseFromDraft(d, settings, categories);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expense).toMatchObject({ kind: 'single', amountCents: 123456, categoryId: 'alimentacion' });
  });

  it('valida el monto', () => {
    const settings = makeSettings();
    const r = buildExpenseFromDraft({ ...createDraft(settings, categories, '2026-11-25'), amountText: '0' }, settings, categories);
    expect(r.ok).toBe(false);
  });
});

describe('cuotas', () => {
  const settings = makeSettings();
  const base = { ...createDraft(settings, categories, '2026-11-25'), amountText: '180.000', paymentMethod: 'credit' as const, mode: 'installments' as const };

  it('sin interés: total = precio', () => {
    const r = buildExpenseFromDraft({ ...base, installmentCount: 6 }, settings, categories);
    expect(r.ok && r.expense.kind === 'installments' && r.expense.installments.financedTotalCents).toBe(180_000_00);
  });

  it('con interés: usa el total financiado y no acepta uno menor al precio', () => {
    const ok = buildExpenseFromDraft({ ...base, interest: 'financed', financedText: '210.000' }, settings, categories);
    expect(ok.ok && ok.expense.kind === 'installments' && ok.expense.installments.financedTotalCents).toBe(210_000_00);
    const bad = buildExpenseFromDraft({ ...base, interest: 'financed', financedText: '100.000' }, settings, categories);
    expect(bad.ok).toBe(false);
  });

  it('cantidad personalizada', () => {
    expect(buildExpenseFromDraft({ ...base, useCustomCount: true, customCountText: '24' }, settings, categories).ok).toBe(true);
    expect(buildExpenseFromDraft({ ...base, useCustomCount: true, customCountText: '1' }, settings, categories).ok).toBe(true);
    expect(buildExpenseFromDraft({ ...base, useCustomCount: true, customCountText: '0' }, settings, categories).ok).toBe(false);
    expect(buildExpenseFromDraft({ ...base, useCustomCount: true, customCountText: '73' }, settings, categories).ok).toBe(false);
  });

  it('solo con crédito', () => {
    expect(buildExpenseFromDraft({ ...base, paymentMethod: 'debit' }, settings, categories).ok).toBe(false);
  });

  it('vista previa de cuotas', () => {
    expect(previewInstallments({ ...base, amountText: '100.000', installmentCount: 3 })).toEqual([3_333_333, 3_333_333, 3_333_334]);
  });
});

describe('edición', () => {
  const settings = makeSettings();

  it('conserva la cotización guardada si no cambia moneda ni cotización', () => {
    const original = single({ currency: 'USD', rateId: 'usd-tarjeta', rateLabel: 'Tarjeta', rateAtCreation: { ARS: 1, USD: 1500, EUR: 1700 } });
    const d = { ...draftFromExpense(original), amountText: '30' };
    const r = buildExpenseFromDraft(d, settings, categories, original);
    expect(r.ok && r.expense.rateAtCreation.USD).toBe(1500);
  });

  it('toma la cotización vigente si se elige otra', () => {
    const original = single({ currency: 'USD', rateId: 'usd-tarjeta', rateAtCreation: { ARS: 1, USD: 1500, EUR: 1700 } });
    const r = buildExpenseFromDraft({ ...draftFromExpense(original), rateId: 'usd-oficial' }, settings, categories, original);
    expect(r.ok && r.expense.rateAtCreation.USD).toBe(1450);
  });

  it('una serie recurrente mantiene su cancelación y toma el día de la fecha', () => {
    const original = recurring({ recurrence: { frequency: 'monthly', dayOfMonth: 28, endedOn: '2026-11-01' } });
    const r = buildExpenseFromDraft({ ...draftFromExpense(original), date: '2026-09-30' }, settings, categories, original);
    expect(r.ok && r.expense.kind === 'recurring' && r.expense.recurrence).toEqual({ frequency: 'monthly', dayOfMonth: 30, endedOn: '2026-11-01' });
  });

  it('precarga cuotas personalizadas', () => {
    const d = draftFromExpense(installments({ installments: { count: 24, interest: 'financed', financedTotalCents: 150_000_00, firstDue: 'this_month' } }));
    expect(d).toMatchObject({ useCustomCount: true, customCountText: '24', interest: 'financed', financedText: '150.000', firstDue: 'this_month' });
  });
});

import { describe, expect, it } from 'vitest';
import { budgetStatus, byCategory, commitmentsByMonth, dailyTotals, realizedInMonth, sumBase, totalOn } from './aggregations';
import { expandOccurrences, isRealized } from './occurrences';
import { installments, makeSettings, recurring, single } from './testing';

const today = '2026-11-25';
const settings = makeSettings();

describe('expandOccurrences', () => {
  it('genera una ocurrencia por cuota, sin duplicar registros', () => {
    const occs = expandOccurrences([installments()], '2026-01-01', '2027-12-31', settings);
    expect(occs).toHaveLength(6);
    expect(occs.map((o) => o.installment?.number)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(occs.every((o) => o.amountCents === 20_000_00)).toBe(true);
  });

  it('agrega la fila informativa si la primera cuota es el mes siguiente', () => {
    const e = installments({
      date: '2026-11-20',
      installments: { count: 3, interest: 'financed', financedTotalCents: 210_000_00, firstDue: 'next_month' },
      amountCents: 180_000_00,
    });
    const occs = expandOccurrences([e], '2026-11-01', '2026-11-30', settings);
    expect(occs).toHaveLength(1);
    expect(occs[0].countsInTotals).toBe(false);
    expect(sumBase(occs)).toBe(0);
  });

  it('convierte con la cotización guardada', () => {
    const e = single({ currency: 'USD', amountCents: 20_00, rateAtCreation: { ARS: 1, USD: 1200, EUR: 1300 } });
    const [o] = expandOccurrences([e], today, today, settings);
    expect(o.amountBase).toBe(24_000);
    const [inUsd] = expandOccurrences([e], today, today, makeSettings({ baseCurrency: 'USD' }));
    expect(inUsd.amountBase).toBe(20);
  });
});

describe('reglas del dashboard', () => {
  const expenses = [
    single({ id: 'hoy', date: today, amountCents: 5_000_00 }),
    single({ id: 'ayer', date: '2026-11-24', amountCents: 3_000_00, categoryId: 'transporte' }),
    // 6 cuotas de 20.000 desde el 10/11 → la de noviembre ya llegó
    installments(),
    // cuota que cae hoy
    installments({ id: 'inst-hoy', date: '2026-10-25', installments: { count: 3, interest: 'none', financedTotalCents: 30_000_00, firstDue: 'next_month' } }),
    // recurrente del 28: en noviembre todavía no llegó
    recurring(),
  ];
  const occs = expandOccurrences(expenses, '2026-01-01', '2027-12-31', settings);

  it('total de hoy: únicos, cuotas y recurrentes que caen hoy', () => {
    expect(totalOn(occs, today)).toBe(5_000 + 10_000);
  });

  it('el mes suma solo el valor de la cuota y los recurrentes ya ocurridos', () => {
    const month = realizedInMonth(occs, '2026-11', today);
    // 5.000 + 3.000 + cuota 20.000 + cuota 10.000; el recurrente del 28/11 todavía no
    expect(sumBase(month)).toBe(38_000);
    expect(month.some((o) => o.kind === 'recurring')).toBe(false);
  });

  it('el historial no muestra cuotas ni recurrentes futuros', () => {
    const future = occs.filter((o) => o.date > today);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((o) => !isRealized(o, today))).toBe(true);
  });

  it('agrupa por categoría con porcentajes', () => {
    const slices = byCategory(realizedInMonth(occs, '2026-11', today));
    expect(slices[0].categoryId).toBe('alimentacion');
    expect(slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 10);
  });

  it('serie diaria de 7 días con ceros', () => {
    const days = dailyTotals(occs, '2026-11-19', today);
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ date: today, total: 15_000 });
    expect(days[0].total).toBe(0);
  });

  it('compromisos: 12 meses con cuotas pendientes y recurrentes', () => {
    const months = commitmentsByMonth(occs, today);
    expect(months).toHaveLength(12);
    expect(months[0].month).toBe('2026-11');
    // noviembre: queda el recurrente del 28
    expect(months[0].total).toBe(35_000);
    // diciembre: cuota 20.000 + cuota 10.000 + recurrente 35.000
    expect(months[1].total).toBe(65_000);
  });
});

describe('presupuesto', () => {
  it('niveles verde / amarillo / rojo', () => {
    expect(budgetStatus(740, 1000).level).toBe('ok');
    expect(budgetStatus(750, 1000).level).toBe('warning');
    expect(budgetStatus(999, 1000).level).toBe('warning');
    expect(budgetStatus(1000, 1000).level).toBe('over');
    expect(budgetStatus(1200, 1000).remaining).toBe(-200);
  });
});

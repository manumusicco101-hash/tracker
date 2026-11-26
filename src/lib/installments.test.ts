import { describe, expect, it } from 'vitest';
import { describeSplit, installmentDates, installmentProgress, installmentSchedule, splitInstallments } from './installments';

describe('splitInstallments', () => {
  it('la última cuota absorbe la diferencia', () => {
    expect(splitInstallments(10_000_000, 3)).toEqual([3_333_333, 3_333_333, 3_333_334]);
  });

  it('la suma coincide exactamente con el total', () => {
    for (const total of [1, 99, 100_001, 12_345_678, 999_999_999]) {
      for (const count of [2, 3, 6, 7, 9, 12, 18, 24]) {
        const parts = splitInstallments(total, count);
        expect(parts).toHaveLength(count);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.min(...parts)).toBeGreaterThanOrEqual(0);
        expect(parts[count - 1]).toBeGreaterThanOrEqual(parts[0]);
      }
    }
  });

  it('rechaza cantidades inválidas', () => {
    expect(() => splitInstallments(100, 0)).toThrow();
  });

  it('describe la división', () => {
    const fmt = (c: number) => String(c / 100);
    expect(describeSplit([2000, 2000, 2000], fmt)).toBe('3 cuotas de 20');
    expect(describeSplit([3333, 3333, 3334], fmt)).toBe('2 × 33.33 + 1 × 33.34');
  });
});

describe('fechas de cuotas', () => {
  it('primera cuota el mes siguiente', () => {
    expect(installmentDates('2026-11-25', 6, 'next_month')).toEqual([
      '2026-12-25',
      '2027-01-25',
      '2027-02-25',
      '2027-03-25',
      '2027-04-25',
      '2027-05-25',
    ]);
  });

  it('primera cuota este mes y día 31 ajustado', () => {
    expect(installmentDates('2027-01-31', 3, 'this_month')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });
});

describe('progreso', () => {
  const plan = {
    date: '2026-09-10',
    installments: { count: 6, interest: 'none' as const, financedTotalCents: 60_000_00, firstDue: 'this_month' as const },
  };

  it('cuenta pagadas las cuotas cuya fecha ya llegó', () => {
    const p = installmentProgress(plan, '2026-11-25');
    expect(p.paidCount).toBe(3);
    expect(p.remainingCents).toBe(30_000_00);
    expect(p.nextDate).toBe('2026-12-10');
    expect(p.nextNumber).toBe(4);
    expect(p.isFinished).toBe(false);
  });

  it('el día de la cuota cuenta como pagada', () => {
    expect(installmentProgress(plan, '2026-11-10').paidCount).toBe(3);
    expect(installmentProgress(plan, '2026-11-09').paidCount).toBe(2);
  });

  it('arma el calendario completo', () => {
    const schedule = installmentSchedule(plan);
    expect(schedule.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(schedule.every((s) => s.amountCents === 10_000_00)).toBe(true);
  });
});

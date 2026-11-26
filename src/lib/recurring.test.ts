import { describe, expect, it } from 'vitest';
import { nextRecurringDate, planPriceChange, recurringDates, recurringOccurrenceNumber } from './recurring';

const series = (date: string, endedOn: string | null = null) => ({
  date,
  recurrence: { frequency: 'monthly' as const, dayOfMonth: Number(date.slice(8)), endedOn },
});

describe('recurringDates', () => {
  it('el día 31 cae el último día y vuelve al 31', () => {
    expect(recurringDates(series('2026-10-31'), '2026-01-01', '2027-03-31')).toEqual([
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
    ]);
  });

  it('respeta el rango pedido', () => {
    expect(recurringDates(series('2026-01-15'), '2026-11-01', '2026-12-31')).toEqual(['2026-11-15', '2026-12-15']);
    expect(recurringDates(series('2026-01-15'), '2026-11-16', '2026-12-14')).toEqual([]);
  });

  it('cancelar frena las futuras y conserva las pasadas', () => {
    const cancelled = series('2026-08-05', '2026-11-20');
    expect(recurringDates(cancelled, '2026-01-01', '2027-12-31')).toEqual([
      '2026-08-05',
      '2026-09-05',
      '2026-10-05',
      '2026-11-05',
    ]);
  });

  it('numera las ocurrencias', () => {
    expect(recurringOccurrenceNumber(series('2026-10-31'), '2027-02-28')).toBe(5);
  });
});

describe('nextRecurringDate', () => {
  it('devuelve la próxima ocurrencia', () => {
    expect(nextRecurringDate(series('2026-01-31'), '2026-11-30')).toBe('2026-12-31');
    expect(nextRecurringDate(series('2026-01-10'), '2026-11-25')).toBe('2026-12-10');
    expect(nextRecurringDate(series('2026-12-01'), '2026-11-25')).toBe('2026-12-01');
  });

  it('null si la serie está cancelada', () => {
    expect(nextRecurringDate(series('2026-01-10', '2026-11-25'), '2026-11-25')).toBeNull();
  });
});

describe('planPriceChange', () => {
  it('cierra hoy y arranca en la próxima ocurrencia', () => {
    expect(planPriceChange(series('2026-03-10'), '2026-11-25')).toEqual({ endedOn: '2026-11-25', startDate: '2026-12-10' });
  });

  it('si todavía no empezó, no hace falta dividir la serie', () => {
    expect(planPriceChange(series('2026-12-10'), '2026-11-25')).toBeNull();
  });
});

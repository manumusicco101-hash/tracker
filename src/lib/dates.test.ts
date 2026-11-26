import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dateInMonth,
  daysInMonth,
  diffMonths,
  formatDayLabel,
  formatLongDate,
  formatNumericDate,
  isValidISODate,
  lastDayOfMonth,
  parseISODate,
  toLocalDate,
  todayISO,
} from './dates';

describe('fechas locales', () => {
  it('corre en la zona horaria de Argentina', () => {
    expect(new Date(2026, 10, 25, 12).getTimezoneOffset()).toBe(180);
  });

  it('no se corre de día como new Date("YYYY-MM-DD")', () => {
    // El bug clásico: new Date('2026-11-25') es medianoche UTC = 24/11 21:00 en Argentina.
    expect(new Date('2026-11-25').getDate()).toBe(24);
    expect(toLocalDate('2026-11-25').getDate()).toBe(25);
  });

  it('todayISO usa la fecha local aunque en UTC ya sea mañana', () => {
    // 25/11 23:30 en Argentina = 26/11 02:30 UTC.
    expect(todayISO(new Date(2026, 10, 25, 23, 30))).toBe('2026-11-25');
  });

  it('parsea y valida', () => {
    expect(parseISODate('2026-02-09')).toEqual({ y: 2026, m: 2, d: 9 });
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('25/11/2026')).toBe(false);
  });

  it('suma días y meses cruzando años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(diffMonths('2026-11', '2027-02')).toBe(3);
  });

  it('ajusta al último día del mes si el día no existe', () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(dateInMonth('2027-02', 31)).toBe('2027-02-28');
    expect(dateInMonth('2026-04', 31)).toBe('2026-04-30');
    expect(dateInMonth('2026-12', 31)).toBe('2026-12-31');
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
  });

  it('formatea Hoy / Ayer / fecha larga', () => {
    expect(formatDayLabel('2026-11-25', '2026-11-25')).toBe('Hoy');
    expect(formatDayLabel('2026-11-24', '2026-11-25')).toBe('Ayer');
    expect(formatDayLabel('2026-11-23', '2026-11-25')).toBe('lunes 23 de noviembre');
    expect(formatLongDate('2025-12-31', '2026-11-25')).toBe('miércoles 31 de diciembre de 2025');
    expect(formatNumericDate('2026-03-05')).toBe('05/03/2026');
  });
});

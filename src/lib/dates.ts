import type { ISODate, YearMonth } from '../types';

// Todas las fechas son strings 'YYYY-MM-DD' en hora local.
// Se parsean a mano y solo se construyen Date con el constructor numérico
// (new Date(y, m - 1, d)), que usa la zona horaria local. Jamás new Date('YYYY-MM-DD'),
// que se interpreta como UTC y en Argentina (UTC-3) devuelve el día anterior.

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export function toISODate(y: number, m: number, d: number): ISODate {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseISODate(s: ISODate): { y: number; m: number; d: number } {
  const match = ISO_DATE_RE.exec(s);
  if (!match) throw new Error(`Fecha inválida: ${s}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string') return false;
  const match = ISO_DATE_RE.exec(s);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isValidYearMonth(s: unknown): s is YearMonth {
  if (typeof s !== 'string') return false;
  const match = YEAR_MONTH_RE.exec(s);
  return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

/** Fecha local de hoy. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Convierte a Date local (mediodía, para que ningún cambio de horario lo corra de día). */
export function toLocalDate(s: ISODate): Date {
  const { y, m, d } = parseISODate(s);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function daysInMonth(y: number, m: number): number {
  // Día 0 del mes siguiente = último día de este mes (constructor numérico: hora local).
  return new Date(y, m, 0).getDate();
}

export function addDays(s: ISODate, n: number): ISODate {
  const { y, m, d } = parseISODate(s);
  const date = new Date(y, m - 1, d + n, 12, 0, 0, 0);
  return toISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function monthOf(s: ISODate): YearMonth {
  return s.slice(0, 7);
}

export function parseYearMonth(ym: YearMonth): { y: number; m: number } {
  const match = YEAR_MONTH_RE.exec(ym);
  if (!match) throw new Error(`Mes inválido: ${ym}`);
  return { y: Number(match[1]), m: Number(match[2]) };
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const { y, m } = parseYearMonth(ym);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return `${year}-${pad2(month)}`;
}

/** Cantidad de meses de `from` a `to` (to - from). */
export function diffMonths(from: YearMonth, to: YearMonth): number {
  const a = parseYearMonth(from);
  const b = parseYearMonth(to);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

/** El día `day` del mes `ym`; si no existe (31 en febrero), el último día del mes. */
export function dateInMonth(ym: YearMonth, day: number): ISODate {
  const { y, m } = parseYearMonth(ym);
  return toISODate(y, m, Math.min(day, daysInMonth(y, m)));
}

export function firstDayOfMonth(ym: YearMonth): ISODate {
  return `${ym}-01`;
}

export function lastDayOfMonth(ym: YearMonth): ISODate {
  const { y, m } = parseYearMonth(ym);
  return toISODate(y, m, daysInMonth(y, m));
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** Día de la semana (0 = domingo). */
export function weekdayOf(s: ISODate): number {
  return toLocalDate(s).getDay();
}

/** "Hoy", "Ayer" o "lunes 23 de noviembre" (con año si no es el actual). */
export function formatDayLabel(s: ISODate, today: ISODate): string {
  if (s === today) return 'Hoy';
  if (s === addDays(today, -1)) return 'Ayer';
  if (s === addDays(today, 1)) return 'Mañana';
  return formatLongDate(s, today);
}

/** "lunes 23 de noviembre" (+ " de 2025" si el año no es el de `today`). */
export function formatLongDate(s: ISODate, today: ISODate): string {
  const { y, m, d } = parseISODate(s);
  const base = `${WEEKDAYS[weekdayOf(s)]} ${d} de ${MONTHS[m - 1]}`;
  return y === parseISODate(today).y ? base : `${base} de ${y}`;
}

/** "25/11/2026" */
export function formatNumericDate(s: ISODate): string {
  const { y, m, d } = parseISODate(s);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

/** "25/11" */
export function formatShortDate(s: ISODate): string {
  const { m, d } = parseISODate(s);
  return `${pad2(d)}/${pad2(m)}`;
}

/** "25 nov" */
export function formatDayMonth(s: ISODate): string {
  const { m, d } = parseISODate(s);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "lun" */
export function formatWeekdayShort(s: ISODate): string {
  return WEEKDAYS_SHORT[weekdayOf(s)];
}

/** "noviembre 2026" */
export function formatMonthLabel(ym: YearMonth): string {
  const { y, m } = parseYearMonth(ym);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "noviembre" */
export function formatMonthName(ym: YearMonth): string {
  return MONTHS[parseYearMonth(ym).m - 1];
}

/** "nov" */
export function formatMonthShort(ym: YearMonth): string {
  return MONTHS_SHORT[parseYearMonth(ym).m - 1];
}

/** Lista de fechas desde `from` hasta `to` inclusive. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Timestamp ISO actual. */
export function nowTimestamp(): string {
  return new Date().toISOString();
}

/** Timestamp ISO a partir de una fecha local y una hora (para datos de ejemplo). */
export function timestampAt(s: ISODate, hour: number, minute = 0): string {
  const { y, m, d } = parseISODate(s);
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}

/** Fecha local a partir de un timestamp ISO (para mostrar "exportado el ..."). */
export function localDateFromTimestamp(ts: string): ISODate {
  return todayISO(new Date(ts));
}

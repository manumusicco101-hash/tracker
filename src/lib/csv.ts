import type { BaseCurrency, Occurrence } from '../types';
import { appliedFactor } from './currency';
import { formatNumericDate } from './dates';
import { KIND_SHORT_LABELS, PAYMENT_METHOD_LABELS } from './labels';

// CSV para Excel con configuración regional argentina:
// separador ";", BOM UTF-8 (acentos), decimales con coma y sin separador de miles.

const BOM = '﻿';
const SEPARATOR = ';';
const NEWLINE = '\r\n';

export interface CsvContext {
  baseCurrency: BaseCurrency;
  categoryName: (id: string) => string;
}

/** Número con coma decimal y sin miles: 1234,56 */
export function csvNumber(value: number, decimals = 2): string {
  const fixed = value.toFixed(decimals);
  return (Object.is(Number(fixed), -0) ? (0).toFixed(decimals) : fixed).replace('.', ',');
}

/** Cotización con hasta 6 decimales, sin ceros de más: 1450 · 0,00069 */
export function csvFactor(value: number): string {
  const fixed = value.toFixed(6).replace(/\.?0+$/, '');
  return fixed.replace('.', ',');
}

/** Escapa un campo de texto y evita que Excel lo interprete como fórmula. */
export function csvText(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[";\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

function detailFor(o: Occurrence): string {
  const parts: string[] = [];
  if (o.installment) parts.push(o.installment.count === 1 ? '1 cuota' : `Cuota ${o.installment.number}/${o.installment.count}`);
  if (o.kind === 'recurring') parts.push('Recurrente');
  if (o.rateLabel && o.currency !== 'ARS') parts.push(`Cotización ${o.rateLabel}`);
  return parts.join(' · ');
}

/** Arma el CSV del historial (solo filas que suman), ordenado por fecha ascendente. */
export function buildHistoryCsv(occurrences: Occurrence[], ctx: CsvContext): string {
  const header = [
    'Fecha',
    'Descripción',
    'Categoría',
    'Método de pago',
    'Monto original',
    'Moneda',
    `Cotización aplicada (${ctx.baseCurrency} por unidad)`,
    `Monto en ${ctx.baseCurrency}`,
    'Modalidad',
    'Detalle',
  ];
  const rows = occurrences
    .filter((o) => o.countsInTotals)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : 1))
    .map((o) =>
      [
        formatNumericDate(o.date),
        csvText(o.note ?? ''),
        csvText(ctx.categoryName(o.categoryId)),
        csvText(PAYMENT_METHOD_LABELS[o.paymentMethod]),
        csvNumber(o.amountCents / 100),
        o.currency,
        csvFactor(appliedFactor(o.currency, ctx.baseCurrency, o.rates)),
        csvNumber(o.amountBase),
        csvText(KIND_SHORT_LABELS[o.kind]),
        csvText(detailFor(o)),
      ].join(SEPARATOR),
    );
  return BOM + [header.map(csvText).join(SEPARATOR), ...rows].join(NEWLINE) + NEWLINE;
}

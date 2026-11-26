import type { CurrencyCode } from '../types';

// Los montos se guardan en centavos (enteros). Se muestran con Intl es-AR:
// "$ 1.234,56", "US$ 20". Si el monto no tiene centavos, se muestra sin decimales.

const MAX_INT_DIGITS = 12;

export const CURRENCY_CODES: CurrencyCode[] = ['ARS', 'USD', 'EUR'];

export function unitsToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToUnits(cents: number): number {
  return cents / 100;
}

/** Redondea a centavos evitando el -0. */
function roundToCents(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

const numberFormatters = new Map<string, Intl.NumberFormat>();

function getFormatter(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-AR', options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

function fractionDigitsFor(value: number): 0 | 2 {
  return Math.round(Math.abs(value) * 100) % 100 === 0 ? 0 : 2;
}

/** "1.234,56" o "1.234" (sin decimales si son cero). */
export function formatNumber(value: number, fixedDigits?: 0 | 2): string {
  const v = roundToCents(value);
  const digits = fixedDigits ?? fractionDigitsFor(v);
  return getFormatter(`n|${digits}`, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

/** "$ 1.234,56", "US$ 20", "€ 12,50". */
export function formatMoney(value: number, currency: CurrencyCode): string {
  const v = roundToCents(value);
  const digits = fractionDigitsFor(v);
  return getFormatter(`c|${currency}|${digits}`, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function formatCents(cents: number, currency: CurrencyCode): string {
  return formatMoney(centsToUnits(cents), currency);
}

/** "USD 20" / "ARS 24.000": código + número, para badges de moneda original. */
export function formatCode(value: number, currency: CurrencyCode): string {
  return `${currency} ${formatNumber(value)}`;
}

/** Cotización "1.450" o "1.450,50". */
export function formatRate(arsPerUnit: number): string {
  return formatNumber(arsPerUnit);
}

/** Texto para precargar un input a partir de centavos: "1.234,56" / "1.234". */
export function centsToInputText(cents: number): string {
  if (!Number.isFinite(cents)) return '';
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const int = Math.floor(abs / 100);
  const dec = abs % 100;
  const grouped = groupThousands(String(int));
  const text = dec === 0 ? grouped : `${grouped},${String(dec).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Interpreta un monto escrito por el usuario y devuelve centavos (o null si es inválido).
 * - Si hay coma, la coma es el decimal y los puntos son miles: "1.234,56" → 123456.
 * - Si no hay coma y hay un único punto seguido de 1–2 dígitos, el punto es decimal
 *   (teclados que mandan punto): "12.5" → 1250.
 * - En cualquier otro caso, los puntos son separadores de miles: "1.234" → 123400.
 */
export function parseAmountInput(raw: string): number | null {
  let s = raw.trim().replace(/[\s $]/g, '').replace(/^(ARS|USD|EUR|US)/i, '');
  if (s === '') return null;
  const hasComma = s.includes(',');
  const dotIsDecimal = !hasComma && /^\d+\.\d{1,2}$/.test(s);
  if (hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (!dotIsDecimal) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [intPart, decPart = ''] = s.split('.');
  if (intPart.replace(/^0+/, '').length > MAX_INT_DIGITS) return null;
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export interface TypingResult {
  value: string;
  caret: number;
}

interface Token {
  ch: string;
  beforeCaret: boolean;
}

/**
 * Formatea en vivo lo que el usuario va tipeando en el input de monto:
 * agrupa miles con punto y deja la coma como decimal (máx. 2 decimales).
 * Si el usuario tipea "." o ",", se toma como separador decimal.
 * Devuelve el nuevo texto y la posición del cursor equivalente.
 */
export function formatAmountTyping(raw: string, caret: number, inserted: string | null): TypingResult {
  const decimalIndex = inserted === '.' || inserted === ',' ? caret - 1 : raw.indexOf(',');

  const intTokens: Token[] = [];
  const decTokens: Token[] = [];
  let decimalToken: Token | null = null;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const beforeCaret = i < caret;
    if (i === decimalIndex && decimalToken === null) {
      decimalToken = { ch: ',', beforeCaret };
      continue;
    }
    if (ch < '0' || ch > '9') continue;
    if (decimalToken) {
      if (decTokens.length < 2) decTokens.push({ ch, beforeCaret });
    } else if (intTokens.length < MAX_INT_DIGITS + 1) {
      intTokens.push({ ch, beforeCaret });
    }
  }

  // Ceros a la izquierda fuera ("007" → "7"), pero "0,5" queda.
  while (intTokens.length > 1 && intTokens[0].ch === '0') intTokens.shift();
  if (intTokens.length > MAX_INT_DIGITS) intTokens.length = MAX_INT_DIGITS;
  if (decimalToken && intTokens.length === 0) {
    intTokens.push({ ch: '0', beforeCaret: decimalToken.beforeCaret });
  }

  const tokens = [...intTokens, ...(decimalToken ? [decimalToken] : []), ...decTokens];
  const significantBefore = tokens.filter((t) => t.beforeCaret).length;

  const grouped = groupThousands(intTokens.map((t) => t.ch).join(''));
  const value = decimalToken ? `${grouped},${decTokens.map((t) => t.ch).join('')}` : grouped;

  let count = 0;
  let newCaret = 0;
  if (significantBefore > 0) {
    for (let i = 0; i < value.length; i += 1) {
      if (value[i] !== '.') count += 1;
      if (count === significantBefore) {
        newCaret = i + 1;
        break;
      }
    }
    if (count < significantBefore) newCaret = value.length;
  }
  return { value, caret: newCaret };
}

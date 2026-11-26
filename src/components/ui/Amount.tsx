import { formatMoney } from '../../lib/money';
import type { CurrencyCode } from '../../types';

interface AmountProps {
  value: number;
  currency: CurrencyCode;
  className?: string;
}

/** Monto formateado es-AR con cifras tabulares (quedan alineadas en columnas). */
export function Amount({ value, currency, className = '' }: AmountProps) {
  return <span className={`tabular-nums whitespace-nowrap ${className}`}>{formatMoney(value, currency)}</span>;
}

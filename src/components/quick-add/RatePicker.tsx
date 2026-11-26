import { convert, currentRateTable, isForeign, ratesFor } from '../../lib/currency';
import { formatMoney, formatRate, parseAmountInput } from '../../lib/money';
import type { CurrencyCode, Expense, Settings } from '../../types';
import { Chip } from '../ui/Chip';

interface RatePickerProps {
  amountText: string;
  currency: CurrencyCode;
  rateId: string | null;
  settings: Settings;
  /** Gasto que se está editando (para mostrar la cotización guardada). */
  editing: Expense | null;
  onChange: (rateId: string) => void;
}

/** Elegir la cotización (Oficial, MEP, Tarjeta…) y ver el monto convertido a la moneda base. */
export function RatePicker({ amountText, currency, rateId, settings, editing, onChange }: RatePickerProps) {
  const base = settings.baseCurrency;
  const options = isForeign(currency) ? ratesFor(settings.rates, currency) : [];
  if (currency === base && options.length === 0) return null;

  const keepsStored = !!editing && editing.currency === currency && (editing.rateId ?? null) === rateId;
  const table = keepsStored ? editing.rateAtCreation : currentRateTable(settings.rates, currency, rateId);
  const amount = parseAmountInput(amountText);
  const converted = amount !== null && amount > 0 ? convert(amount / 100, currency, base, table) : null;
  const reference = currency === 'ARS' ? 'USD' : currency;

  return (
    <div className="space-y-2">
      {options.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Cotización">
          {options.map((rate) => (
            <Chip key={rate.id} selected={rate.id === rateId} onClick={() => onChange(rate.id)}>
              <span>{rate.label || currency}</span>
              <span className="tabular-nums opacity-70">{formatRate(rate.arsPerUnit)}</span>
            </Chip>
          ))}
        </div>
      )}
      {currency !== base && (
        <p className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
          {converted !== null && <span className="font-medium text-zinc-700 dark:text-zinc-200">≈ {formatMoney(converted, base)} · </span>}
          {keepsStored ? 'Cotización guardada: ' : ''}1 {reference} = {formatRate(table[reference])} ARS
        </p>
      )}
    </div>
  );
}

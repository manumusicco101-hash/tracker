import { CalendarClock } from 'lucide-react';
import type { ExpenseDraft, DraftErrors } from '../../lib/draft';
import { previewInstallments } from '../../lib/draft';
import { addMonths, dateInMonth, formatShortDate, monthOf, parseISODate } from '../../lib/dates';
import { describeSplit, INSTALLMENT_PRESETS, interestCents } from '../../lib/installments';
import { formatCents, parseAmountInput } from '../../lib/money';
import { Chip } from '../ui/Chip';
import { SegmentedControl } from '../ui/SegmentedControl';
import { AmountInput } from './AmountInput';

interface InstallmentOptionsProps {
  draft: ExpenseDraft;
  errors: DraftErrors;
  onChange: (patch: Partial<ExpenseDraft>) => void;
}

export function InstallmentOptions({ draft, errors, onChange }: InstallmentOptionsProps) {
  const preview = previewInstallments(draft);
  const format = (cents: number) => formatCents(cents, draft.currency);
  const amount = parseAmountInput(draft.amountText);
  const financed = parseAmountInput(draft.financedText);
  const interest =
    draft.interest === 'financed' && amount !== null && financed !== null && financed >= amount
      ? interestCents({ amountCents: amount, installments: { count: 1, interest: 'financed', financedTotalCents: financed, firstDue: draft.firstDue } })
      : null;
  const firstDate = dateInMonth(addMonths(monthOf(draft.date), draft.firstDue === 'next_month' ? 1 : 0), parseISODate(draft.date).d);

  return (
    <div className="space-y-4 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
      <div>
        <span className="label">Cantidad de cuotas</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Cantidad de cuotas">
          {INSTALLMENT_PRESETS.map((n) => (
            <Chip key={n} selected={!draft.useCustomCount && draft.installmentCount === n} onClick={() => onChange({ installmentCount: n, useCustomCount: false })}>
              {n}
            </Chip>
          ))}
          <Chip selected={draft.useCustomCount} onClick={() => onChange({ useCustomCount: true })}>
            Otra
          </Chip>
        </div>
        {draft.useCustomCount && (
          <div className="mt-2">
            <label htmlFor="custom-installments" className="sr-only">
              Cantidad personalizada
            </label>
            <input
              id="custom-installments"
              className="input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Ej.: 24"
              value={draft.customCountText}
              onChange={(e) => onChange({ customCountText: e.currentTarget.value.replace(/\D/g, '').slice(0, 2) })}
            />
          </div>
        )}
        {errors.installments && <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{errors.installments}</p>}
      </div>

      <div>
        <span className="label">Interés</span>
        <SegmentedControl
          ariaLabel="Interés"
          value={draft.interest}
          onChange={(interestValue) => onChange({ interest: interestValue })}
          options={[
            { value: 'none', label: 'Sin interés' },
            { value: 'financed', label: 'Con interés' },
          ]}
        />
        {draft.interest === 'financed' && (
          <div className="mt-2">
            <AmountInput
              id="financed-total"
              label="Total financiado"
              size="md"
              currency={draft.currency}
              value={draft.financedText}
              onChange={(financedText) => onChange({ financedText })}
              error={errors.financed}
              placeholder="Lo que vas a pagar en total"
            />
            {interest !== null && interest > 0 && (
              <p className="mt-1.5 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">Interés: {format(interest)}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <span className="label">Primera cuota en</span>
        <SegmentedControl
          ariaLabel="Primera cuota en"
          value={draft.firstDue}
          onChange={(firstDue) => onChange({ firstDue })}
          options={[
            { value: 'this_month', label: 'Este mes' },
            { value: 'next_month', label: 'El mes siguiente' },
          ]}
        />
      </div>

      <p className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden />
        <span className="tabular-nums">
          {preview ? describeSplit(preview, format) : 'Ingresá el monto para ver las cuotas'}
          {preview && <> · 1ª cuota el {formatShortDate(firstDate)}</>}
        </span>
      </p>
    </div>
  );
}

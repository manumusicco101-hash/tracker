import { Ban, CalendarClock, CircleCheck, Pencil, Repeat, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sumBase } from '../../lib/aggregations';
import { convert } from '../../lib/currency';
import { formatDayMonth, formatLongDate, formatNumericDate, localDateFromTimestamp } from '../../lib/dates';
import { expenseTitle } from '../../lib/expenses';
import { describeSplit, installmentCountLabel, installmentProgress, installmentSchedule, interestCents } from '../../lib/installments';
import { KIND_LABELS, PAYMENT_METHOD_LABELS } from '../../lib/labels';
import { formatCents, formatCode, formatMoney, formatRate, parseAmountInput } from '../../lib/money';
import { expandExpense } from '../../lib/occurrences';
import { isRecurringActive, nextRecurringDate } from '../../lib/recurring';
import { useAppData } from '../../state/AppDataProvider';
import { useExpenseActions } from '../../hooks/useExpenseActions';
import { useToast } from '../../state/ToastProvider';
import { useUI } from '../../state/UIContext';
import type { Expense, Occurrence } from '../../types';
import { errorMessage } from '../../utils/download';
import { CategoryIcon } from '../icons/CategoryIcon';
import { PAYMENT_ICONS } from '../icons/paymentIcons';
import { AmountInput } from '../quick-add/AmountInput';
import { Badge } from '../ui/Badge';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

interface ExpenseDetailSheetProps {
  open: boolean;
  expenseId: string | null;
  occurrence?: Occurrence;
  onClose: () => void;
}

export function ExpenseDetailSheet({ open, expenseId, occurrence, onClose }: ExpenseDetailSheetProps) {
  const { expenseById } = useAppData();
  const found = expenseId ? expenseById.get(expenseId) : undefined;
  // Se conserva el último gasto mostrado para que la animación de cierre no quede vacía.
  const lastRef = useRef<Expense | undefined>(undefined);
  if (found) lastRef.current = found;
  const expense = found ?? lastRef.current;

  useEffect(() => {
    if (open && expenseId && !found) onClose();
  }, [open, expenseId, found, onClose]);

  return (
    <BottomSheet open={open && !!expense} onClose={onClose} title="Detalle del gasto">
      {expense && <DetailContent key={expense.id} expense={expense} occurrence={occurrence} onClose={onClose} />}
    </BottomSheet>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-zinc-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}

function DetailContent({ expense: e, occurrence, onClose }: { expense: Expense; occurrence?: Occurrence; onClose: () => void }) {
  const { categoryById, settings, today, actions } = useAppData();
  const { openEditExpense } = useUI();
  const toast = useToast();
  const { deleteWithUndo, cancelRecurringWithUndo } = useExpenseActions();
  const [priceText, setPriceText] = useState('');
  const [priceFormOpen, setPriceFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const base = settings.baseCurrency;
  const category = categoryById.get(e.categoryId);
  const title = expenseTitle(e.note, category?.name ?? 'Otros');
  const PaymentIcon = PAYMENT_ICONS[e.paymentMethod];
  const toBase = (cents: number) => convert(cents / 100, e.currency, base, e.rateAtCreation);
  const isSeries = e.kind !== 'single';

  const handleDelete = () => deleteWithUndo(e, onClose);
  const handleCancelRecurring = () => cancelRecurringWithUndo(e);

  const handlePriceChange = async () => {
    const cents = parseAmountInput(priceText);
    if (cents === null || cents <= 0) {
      toast.show({ message: 'Ingresá un monto mayor a cero.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const result = await actions.changeRecurringAmount(e.id, cents);
      toast.show({
        message: result === 'split' ? 'Nuevo monto desde la próxima ocurrencia' : 'Monto actualizado',
        tone: 'success',
      });
      if (result === 'split') onClose();
      setPriceFormOpen(false);
      setPriceText('');
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <CategoryIcon icon={category?.icon ?? 'ellipsis'} color={category?.color ?? '#71717a'} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-tight font-semibold break-words">{title}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{category?.name ?? 'Otros'}</Badge>
            {e.kind === 'recurring' && (
              <Badge tone="cyan" icon={<Repeat className="size-3" aria-hidden />}>
                Recurrente
              </Badge>
            )}
            {e.kind === 'installments' && <Badge tone="indigo">{installmentCountLabel(e.installments.count)}</Badge>}
            {occurrence?.installment && occurrence.installment.count > 1 && (
              <Badge tone="indigo">
                Viendo cuota {occurrence.installment.number}/{occurrence.installment.count}
              </Badge>
            )}
            {e.isSample && <Badge>Ejemplo</Badge>}
          </div>
        </div>
      </div>

      {/* Monto */}
      <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/40">
        <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {e.kind === 'installments' ? 'Total de la compra' : e.kind === 'recurring' ? 'Monto mensual' : 'Monto'}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {formatCents(e.kind === 'installments' ? e.installments.financedTotalCents : e.amountCents, e.currency)}
        </p>
        {e.currency !== base && (
          <p className="mt-1 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
            ≈ {formatMoney(toBase(e.kind === 'installments' ? e.installments.financedTotalCents : e.amountCents), base)}
            {e.currency !== 'ARS' && (
              <>
                {' · '}
                {e.rateLabel ? `${e.currency} ${e.rateLabel}` : e.currency} {formatRate(e.rateAtCreation[e.currency])}
              </>
            )}
          </p>
        )}
        {e.kind === 'recurring' && e.currency !== 'ARS' && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Cada ocurrencia se convierte con la cotización vigente en su fecha.
          </p>
        )}
      </div>

      {e.kind === 'installments' && <InstallmentsDetail expense={e} highlight={occurrence?.installment?.number} toBase={toBase} />}
      {e.kind === 'recurring' && <RecurringDetail expense={e} />}

      {/* Datos */}
      <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
        <InfoRow label={e.kind === 'recurring' ? 'Inicio' : 'Fecha'}>
          <span className="first-letter:uppercase">{formatLongDate(e.date, today)}</span>
        </InfoRow>
        <InfoRow label="Método de pago">
          <span className="inline-flex items-center gap-1.5">
            <PaymentIcon className="size-4 text-zinc-400" aria-hidden />
            {PAYMENT_METHOD_LABELS[e.paymentMethod]}
          </span>
        </InfoRow>
        <InfoRow label="Modalidad">{KIND_LABELS[e.kind]}</InfoRow>
        {e.currency !== 'ARS' && <InfoRow label="Moneda original">{formatCode(e.amountCents / 100, e.currency)}</InfoRow>}
        <InfoRow label="Cargado el">{formatNumericDate(localDateFromTimestamp(e.createdAt))}</InfoRow>
      </dl>

      {/* Recurrente: cambiar precio / cancelar */}
      {e.kind === 'recurring' && isRecurringActive(e) && (
        <div className="space-y-2">
          {priceFormOpen ? (
            <div className="space-y-2 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <AmountInput
                id="price-change"
                label="Nuevo monto mensual"
                size="md"
                currency={e.currency}
                value={priceText}
                onChange={setPriceText}
                onEnter={() => void handlePriceChange()}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Las ocurrencias pasadas mantienen el monto anterior.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setPriceFormOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => void handlePriceChange()} disabled={busy}>
                  Aplicar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" block onClick={() => setPriceFormOpen(true)}>
              Cambiar monto desde la próxima
            </Button>
          )}
          <Button variant="danger-soft" block onClick={() => void handleCancelRecurring()}>
            <Ban className="size-4" aria-hidden /> Cancelar recurrente
          </Button>
        </div>
      )}

      {isSeries && (
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {e.kind === 'installments'
            ? e.installments.count === 1
              ? 'Editar o eliminar afecta a esta compra.'
              : 'Editar o eliminar afecta a la compra completa, con todas sus cuotas.'
            : 'Editar o eliminar afecta a toda la serie, incluidas las ocurrencias pasadas.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 pb-1">
        <Button variant="danger-soft" onClick={() => void handleDelete()}>
          <Trash2 className="size-4" aria-hidden /> Eliminar
        </Button>
        <Button onClick={() => openEditExpense(e)}>
          <Pencil className="size-4" aria-hidden /> Editar
        </Button>
      </div>
    </div>
  );
}

function InstallmentsDetail({
  expense: e,
  highlight,
  toBase,
}: {
  expense: Extract<Expense, { kind: 'installments' }>;
  highlight?: number;
  toBase: (cents: number) => number;
}) {
  const { today, settings } = useAppData();
  const schedule = installmentSchedule(e);
  const progress = installmentProgress(e, today);
  const interest = interestCents(e);
  const format = (cents: number) => formatCents(cents, e.currency);

  // 1 cuota = un solo pago con la tarjeta: alcanza con decir cuándo se paga.
  if (schedule.length === 1) {
    const [only] = schedule;
    const paid = only.date <= today;
    return (
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {paid ? (
            <CircleCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <CalendarClock className="size-4 shrink-0 text-zinc-400" aria-hidden />
          )}
          Un solo pago con la tarjeta · {paid ? 'pagado' : 'se paga'} el {formatNumericDate(only.date)}
        </p>
        {e.installments.interest === 'financed' && (
          <p className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
            Precio de contado {format(e.amountCents)} · interés {format(interest)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {progress.paidCount} de {progress.count} pagadas
          </span>
          <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
            Restan {formatMoney(toBase(progress.remainingCents), settings.baseCurrency)}
          </span>
        </div>
        <ProgressBar percent={(progress.paidCount / progress.count) * 100} label="Cuotas pagadas" colorClass="bg-indigo-500" />
        <p className="mt-2 text-sm text-zinc-600 tabular-nums dark:text-zinc-300">{describeSplit(schedule.map((s) => s.amountCents), format)}</p>
        {e.installments.interest === 'financed' && (
          <p className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
            Precio de contado {format(e.amountCents)} · interés {format(interest)}
          </p>
        )}
      </div>
      <ol className="max-h-64 divide-y divide-zinc-100 overflow-y-auto rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {schedule.map((item) => {
          const paid = item.date <= today;
          const isHighlighted = item.number === highlight;
          return (
            <li
              key={item.number}
              className={`flex items-center gap-3 px-3 py-2 text-sm ${isHighlighted ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}
            >
              {paid ? (
                <CircleCheck className="size-4 shrink-0 text-emerald-500" aria-label="Pagada" />
              ) : (
                <CalendarClock className="size-4 shrink-0 text-zinc-400" aria-label="Pendiente" />
              )}
              <span className="w-16 shrink-0 font-medium">Cuota {item.number}</span>
              <span className="flex-1 text-zinc-500 dark:text-zinc-400">{formatNumericDate(item.date)}</span>
              <span className="font-medium tabular-nums">{format(item.amountCents)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RecurringDetail({ expense: e }: { expense: Extract<Expense, { kind: 'recurring' }> }) {
  const { today, settings } = useAppData();
  const active = isRecurringActive(e);
  const next = nextRecurringDate(e, today);
  const past = expandExpense(e, e.date, today, settings);
  const paidTotal = sumBase(past);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Estado</p>
        <p className={`mt-0.5 font-semibold ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>
          {active ? 'Activo' : `Cancelado el ${formatDayMonth(e.recurrence.endedOn ?? today)}`}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Día {e.recurrence.dayOfMonth} de cada mes</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{next ? 'Próxima' : 'Ocurrencias'}</p>
        <p className="mt-0.5 font-semibold tabular-nums">{next ? formatDayMonth(next) : past.length}</p>
        <p className="mt-0.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {past.length} {past.length === 1 ? 'vez' : 'veces'} · {formatMoney(paidTotal, settings.baseCurrency)}
        </p>
      </div>
    </div>
  );
}

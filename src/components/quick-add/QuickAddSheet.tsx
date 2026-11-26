import { CalendarDays, Info, Repeat } from 'lucide-react';
import { useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { defaultRate, isForeign } from '../../lib/currency';
import { addDays, formatDayLabel, formatShortDate, isValidISODate, parseISODate } from '../../lib/dates';
import { buildExpenseFromDraft, createDraft, draftFromExpense, type DraftErrors, type ExpenseDraft } from '../../lib/draft';
import { installmentDates } from '../../lib/installments';
import { KIND_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '../../lib/labels';
import { CURRENCY_CODES } from '../../lib/money';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import type { Expense, ExpenseKind } from '../../types';
import { errorMessage } from '../../utils/download';
import { PAYMENT_ICONS } from '../icons/paymentIcons';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { SegmentedControl } from '../ui/SegmentedControl';
import { AmountInput } from './AmountInput';
import { CategoryPicker } from './CategoryPicker';
import { InstallmentOptions } from './InstallmentOptions';
import { RatePicker } from './RatePicker';

export interface QuickAddHandle {
  /** Abre para un gasto nuevo y enfoca el monto en el mismo toque (abre el teclado en iOS). */
  openNew: () => void;
  openEdit: (expense: Expense) => void;
}

export function QuickAddSheet({ ref }: { ref?: Ref<QuickAddHandle> }) {
  const { settings, categories, today, actions } = useAppData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(() => createDraft(settings, categories, today));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      openNew() {
        // Se enfoca antes de re-renderizar: iOS solo abre el teclado si el focus()
        // ocurre dentro del mismo gesto del usuario.
        if (panelRef.current) panelRef.current.inert = false;
        amountRef.current?.focus({ preventScroll: true });
        setEditing(null);
        setDraft(createDraft(settings, categories, today));
        setErrors({});
        setOpen(true);      },
      openEdit(expense: Expense) {
        setEditing(expense);
        setDraft(draftFromExpense(expense));
        setErrors({});
        setOpen(true);      },
    }),
    [settings, categories, today],
  );

  const close = useCallback(() => {
    if (document.activeElement instanceof HTMLElement && panelRef.current?.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    setOpen(false);
  }, []);

  const update = (patch: Partial<ExpenseDraft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      // Las cuotas solo existen con crédito.
      if (next.mode === 'installments' && next.paymentMethod !== 'credit') next.mode = 'single';
      return next;
    });
    const keys = Object.keys(patch);
    if (keys.some((k) => k === 'amountText' || k === 'financedText' || k === 'customCountText' || k === 'useCustomCount')) {
      setErrors((e) => ({ ...e, amount: undefined, financed: undefined, installments: undefined }));
    }
  };

  const save = async () => {
    if (saving) return;
    const result = buildExpenseFromDraft(draft, settings, categories, editing ?? undefined);
    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.amount) amountRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const e = result.expense;
      if (editing) {
        await actions.updateExpense(editing.id, e);
        toast.show({ message: 'Cambios guardados', tone: 'success' });
      } else {
        await actions.addExpense(e);
        await actions.rememberQuickAdd(draft.categoryId, draft.paymentMethod);
        let message = 'Gasto guardado';
        if (e.kind === 'installments') {
          const first = installmentDates(e.date, e.installments.count, e.installments.firstDue)[0];
          message = `Compra en ${e.installments.count} cuotas guardada · 1ª el ${formatShortDate(first)}`;
        } else if (e.kind === 'recurring') {
          message = `Recurrente guardado · se repite el día ${e.recurrence.dayOfMonth}`;
        }
        toast.show({ message, tone: 'success' });
      }
      close();
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const modeOptions: Array<{ value: ExpenseKind; label: string; disabled?: boolean; title?: string }> = [
    { value: 'single', label: 'Único' },
    {
      value: 'installments',
      label: 'Cuotas',
      disabled: draft.paymentMethod !== 'credit',
      title: draft.paymentMethod !== 'credit' ? 'Elegí Crédito para pagar en cuotas' : undefined,
    },
    { value: 'recurring', label: 'Recurrente' },
  ];

  const day = isValidISODate(draft.date) ? parseISODate(draft.date).d : 1;
  const yesterday = addDays(today, -1);

  return (
    <BottomSheet
      open={open}
      onClose={close}
      keepMounted
      panelRef={panelRef}
      title={editing ? 'Editar gasto' : 'Nuevo gasto'}
      headerAction={
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {editing && editing.kind !== 'single' && (
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {editing.kind === 'installments'
              ? `Estás editando la compra completa (${editing.installments.count} cuotas): los cambios afectan a todas las cuotas.`
              : 'Estás editando toda la serie: los cambios afectan también a las ocurrencias pasadas.'}
          </p>
        )}

        <div className="space-y-3">
          <AmountInput
            id="quick-amount"
            label="Monto"
            inputRef={amountRef}
            value={draft.amountText}
            currency={draft.currency}
            onChange={(amountText) => update({ amountText })}
            error={errors.amount}
            onEnter={() => void save()}
          />
          <SegmentedControl
            ariaLabel="Moneda"
            value={draft.currency}
            onChange={(currency) =>
              update({ currency, rateId: isForeign(currency) ? (defaultRate(settings.rates, currency)?.id ?? null) : null })
            }
            options={CURRENCY_CODES.map((c) => ({ value: c, label: c }))}
          />
          <RatePicker
            amountText={draft.amountText}
            currency={draft.currency}
            rateId={draft.rateId}
            settings={settings}
            editing={editing}
            onChange={(rateId) => update({ rateId })}
          />
        </div>

        <CategoryPicker
          categories={categories}
          value={draft.categoryId}
          onChange={(categoryId) => update({ categoryId })}
          error={errors.category}
        />

        <div>
          <span className="label">Método de pago</span>
          <SegmentedControl
            ariaLabel="Método de pago"
            stacked
            value={draft.paymentMethod}
            onChange={(paymentMethod) => update({ paymentMethod })}
            options={PAYMENT_METHODS.map((m) => {
              const Icon = PAYMENT_ICONS[m];
              return { value: m, label: m === 'transfer' ? 'Transf.' : PAYMENT_METHOD_LABELS[m], icon: <Icon className="size-4" aria-hidden /> };
            })}
          />
        </div>

        <div className="space-y-3">
          <div>
            <span className="label">Modalidad</span>
            <SegmentedControl ariaLabel="Modalidad" value={draft.mode} onChange={(mode) => update({ mode })} options={modeOptions} />
            {draft.paymentMethod !== 'credit' && (
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Las cuotas se habilitan con Crédito.</p>
            )}
          </div>
          {draft.mode === 'installments' && <InstallmentOptions draft={draft} errors={errors} onChange={update} />}
          {draft.mode === 'recurring' && (
            <p className="flex items-start gap-2 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300">
              <Repeat className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden />
              <span>
                Se repite el día {day} de cada mes hasta que lo canceles.
                {day > 28 && ` En los meses que no tienen día ${day}, cae el último día del mes.`}
              </span>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="quick-date" className="label">
            {draft.mode === 'recurring' ? 'Primera ocurrencia' : draft.mode === 'installments' ? 'Fecha de compra' : 'Fecha'}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Chip selected={draft.date === today} onClick={() => update({ date: today })}>
              Hoy
            </Chip>
            <Chip selected={draft.date === yesterday} onClick={() => update({ date: yesterday })}>
              Ayer
            </Chip>
            <div className="relative min-w-40 flex-1">
              <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input
                id="quick-date"
                type="date"
                className="input pl-9"
                value={draft.date}
                max="2100-12-31"
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  if (isValidISODate(value)) update({ date: value });
                }}
              />
            </div>
          </div>
          {isValidISODate(draft.date) && draft.date !== today && draft.date !== yesterday && (
            <p className="mt-1.5 text-xs text-zinc-500 first-letter:uppercase dark:text-zinc-400">{formatDayLabel(draft.date, today)}</p>
          )}
          {errors.date && <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{errors.date}</p>}
        </div>

        <div>
          <label htmlFor="quick-note" className="label">
            Nota <span className="font-normal normal-case">(opcional)</span>
          </label>
          <input
            id="quick-note"
            className="input"
            type="text"
            maxLength={120}
            enterKeyHint="done"
            placeholder="Ej.: Supermercado, Netflix, regalo…"
            value={draft.note}
            onChange={(e) => update({ note: e.currentTarget.value })}
          />
        </div>

        <Button type="submit" size="lg" block disabled={saving}>
          {editing ? 'Guardar cambios' : `Guardar ${draft.mode === 'single' ? 'gasto' : KIND_LABELS[draft.mode].toLowerCase()}`}
        </Button>
      </form>
    </BottomSheet>
  );
}

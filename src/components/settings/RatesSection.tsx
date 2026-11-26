import { ArrowLeftRight, Pencil, Plus, RefreshCw, Star, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import { FOREIGN_CURRENCIES, ratesFor } from '../../lib/currency';
import { formatDayMonth, localDateFromTimestamp } from '../../lib/dates';
import { RATE_LABEL_SUGGESTIONS } from '../../lib/labels';
import { centsToInputText, formatRate, parseAmountInput } from '../../lib/money';
import { QUOTE_PROVIDER_NAMES, QUOTE_SOURCES, quoteSourcesFor } from '../../lib/quoteSources';
import { formatAge } from '../../lib/quotes';
import { useAppData, type QuoteSyncResult } from '../../state/AppDataProvider';
import { useConfirm } from '../../state/ConfirmProvider';
import { useToast } from '../../state/ToastProvider';
import type { ExchangeRate, ForeignCurrency, QuoteSource } from '../../types';
import { errorMessage } from '../../utils/download';
import { AmountInput } from '../quick-add/AmountInput';
import { Badge } from '../ui/Badge';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ToggleRow } from '../ui/ToggleRow';
import { SettingsCard } from './SettingsCard';

type EditorState = { mode: 'new'; currency: ForeignCurrency } | { mode: 'edit'; rate: ExchangeRate };

function describeSync(result: QuoteSyncResult): string {
  const provider = QUOTE_PROVIDER_NAMES[result.provider];
  const changed = result.changes.length;
  let message = changed === 0 ? `Las cotizaciones ya estaban al día (${provider})` : `Se actualizó ${changed} cotización (${provider})`;
  if (changed > 1) message = `Se actualizaron ${changed} cotizaciones (${provider})`;
  if (result.rejected > 0) message += ` · se ignoró ${result.rejected === 1 ? 'un valor' : `${result.rejected} valores`} que no parecía real`;
  return message;
}

export function RatesSection() {
  const { settings, expenses, actions } = useAppData();
  const confirm = useConfirm();
  const toast = useToast();
  const [editor, setEditor] = useState<EditorState | null>(null);

  const recalculate = async () => {
    const summary = FOREIGN_CURRENCIES.map((c) => {
      const rate = ratesFor(settings.rates, c)[0];
      return rate ? `1 ${c} = ${formatRate(rate.arsPerUnit)} ARS` : '';
    })
      .filter(Boolean)
      .join(' · ');
    const ok = await confirm({
      title: '¿Recalcular todo con la cotización actual?',
      message: (
        <>
          <p>
            Se reemplaza la cotización guardada de tus {expenses.length} gastos por la vigente ({summary}). Los gastos en moneda extranjera
            mantienen la cotización que eligieron (Oficial, MEP, Tarjeta…).
          </p>
          <p className="mt-2">Los totales históricos van a cambiar. Vas a poder deshacerlo durante unos segundos.</p>
        </>
      ),
      confirmLabel: 'Recalcular',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const before = await actions.recalculateAllRates();
      toast.show({
        message: 'Todo quedó recalculado con la cotización actual',
        action: { label: 'Deshacer', onClick: () => void actions.importBackup(before) },
        duration: 10000,
      });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <SettingsCard
      id="rates-title"
      title="Cotizaciones"
      description="Contra pesos (ARS). Un cambio solo afecta a los gastos nuevos; los recurrentes usan la vigente en cada fecha."
      icon={<ArrowLeftRight className="size-5" />}
    >
      <div className="space-y-4">
        <LiveQuotesPanel />
        {FOREIGN_CURRENCIES.map((currency) => (
          <div key={currency}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">{currency}</span>
              <Button size="sm" variant="ghost" onClick={() => setEditor({ mode: 'new', currency })}>
                <Plus className="size-4" aria-hidden /> Agregar
              </Button>
            </div>
            <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {ratesFor(settings.rates, currency).map((rate) => (
                <li key={rate.id}>
                  <button
                    type="button"
                    onClick={() => setEditor({ mode: 'edit', rate })}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <Star
                      className={`size-4 shrink-0 ${rate.isDefault ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-600'}`}
                      aria-label={rate.isDefault ? 'Por defecto' : undefined}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{rate.label || 'Sin etiqueta'}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {rate.autoSource ? (
                          <Badge tone="indigo" icon={<Zap className="size-3" aria-hidden />}>
                            En vivo
                          </Badge>
                        ) : (
                          <span>Manual ·</span>
                        )}
                        <span className="truncate">{formatDayMonth(localDateFromTimestamp(rate.updatedAt))}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">1 {currency} =</span>
                      <span className="block text-sm font-semibold">$ {formatRate(rate.arsPerUnit)}</span>
                    </span>
                    <Pencil className="size-4 shrink-0 text-zinc-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Button variant="secondary" block onClick={() => void recalculate()}>
          <RefreshCw className="size-4" aria-hidden /> Recalcular todo con la cotización actual
        </Button>
      </div>
      <RateEditorSheet state={editor} onClose={() => setEditor(null)} />
    </SettingsCard>
  );
}

/** Interruptor de actualización automática, estado de la última consulta y botón para actualizar ya. */
function LiveQuotesPanel() {
  const { settings, quotesSync, actions } = useAppData();
  const toast = useToast();
  const { autoUpdate, lastSyncAt, provider } = settings.quotes;
  const hasLive = settings.rates.some((rate) => rate.autoSource);

  const setAutoUpdate = async (value: boolean) => {
    try {
      await actions.updateSettings({ quotes: { ...settings.quotes, autoUpdate: value } });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  const refreshNow = async () => {
    try {
      toast.show({ message: describeSync(await actions.syncQuotes()), tone: 'success' });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  let status: string;
  if (quotesSync.syncing) status = 'Consultando cotizaciones…';
  else if (!hasLive) status = 'Ninguna cotización sigue una fuente en vivo. Elegí una al editarla.';
  else if (lastSyncAt) status = `Consultadas ${formatAge(lastSyncAt, Date.now())}${provider ? ` · ${QUOTE_PROVIDER_NAMES[provider]}` : ''}`;
  else status = 'Todavía no se consultaron.';

  return (
    <div className="space-y-2.5">
      <ToggleRow
        checked={autoUpdate}
        onChange={(value) => void setAutoUpdate(value)}
        title="Actualizar automáticamente"
        description="Al abrir la app y cada 30 minutos mientras está abierta. Solo cambia las cotizaciones «En vivo»."
      />
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          <p>{status}</p>
          {quotesSync.error && <p className="mt-0.5 text-rose-600 dark:text-rose-400">{quotesSync.error}</p>}
          {provider === 'bluelytics' && !quotesSync.syncing && (
            <p className="mt-0.5">Bluelytics no trae MEP ni Tarjeta: esas quedan con su último valor.</p>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => void refreshNow()} disabled={quotesSync.syncing || !hasLive}>
          <RefreshCw className={`size-4 ${quotesSync.syncing ? 'animate-spin' : ''}`} aria-hidden /> Actualizar ahora
        </Button>
      </div>
    </div>
  );
}

function RateEditorSheet({ state, onClose }: { state: EditorState | null; onClose: () => void }) {
  return (
    <BottomSheet open={state !== null} onClose={onClose} title={state?.mode === 'edit' ? 'Editar cotización' : 'Nueva cotización'}>
      {state && <RateEditorForm key={state.mode === 'edit' ? state.rate.id : `new-${state.currency}`} state={state} onDone={onClose} />}
    </BottomSheet>
  );
}

function RateEditorForm({ state, onDone }: { state: EditorState; onDone: () => void }) {
  const { settings, actions } = useAppData();
  const toast = useToast();
  const confirm = useConfirm();
  const existing = state.mode === 'edit' ? state.rate : null;
  const [currency, setCurrency] = useState<ForeignCurrency>(existing?.currency ?? (state.mode === 'new' ? state.currency : 'USD'));
  const [label, setLabel] = useState(existing?.label ?? '');
  const [autoSource, setAutoSource] = useState<QuoteSource | null>(existing?.autoSource ?? null);
  const [valueText, setValueText] = useState(existing ? centsToInputText(Math.round(existing.arsPerUnit * 100)) : '');
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const canDelete = !!existing && settings.rates.filter((r) => r.currency === existing.currency).length > 1;

  const changeCurrency = (next: ForeignCurrency) => {
    setCurrency(next);
    // Una fuente en vivo es de una sola moneda.
    if (autoSource && QUOTE_SOURCES[autoSource].currency !== next) setAutoSource(null);
  };

  const changeSource = (value: string) => {
    const next = value === '' ? null : (value as QuoteSource);
    setAutoSource(next);
    setError(undefined);
    if (next && !label.trim()) setLabel(QUOTE_SOURCES[next].label);
  };

  const save = async () => {
    let arsPerUnit = existing?.arsPerUnit ?? 0;
    if (!autoSource) {
      const cents = parseAmountInput(valueText);
      if (cents === null || cents <= 0) {
        setError('Ingresá cuántos pesos vale 1 unidad.');
        return;
      }
      arsPerUnit = cents / 100;
    }
    setSaving(true);
    try {
      await actions.saveRate({ id: existing?.id, currency, label, arsPerUnit, isDefault, autoSource });
      toast.show({
        message: autoSource ? 'Listo: esta cotización se actualiza sola' : existing ? 'Cotización actualizada (solo para gastos nuevos)' : 'Cotización agregada',
        tone: 'success',
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: '¿Eliminar esta cotización?',
      message: 'Los gastos que ya la usaron conservan su cotización guardada.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await actions.removeRate(existing.id);
      toast.show({ message: 'Cotización eliminada' });
      onDone();
    } catch (err) {
      toast.show({ message: errorMessage(err), tone: 'error' });
    }
  };

  return (
    <form
      className="space-y-5 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {!existing && (
        <div>
          <span className="label">Moneda</span>
          <SegmentedControl ariaLabel="Moneda" value={currency} onChange={changeCurrency} options={FOREIGN_CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </div>
      )}
      <div>
        <label htmlFor="rate-label" className="label">
          Etiqueta <span className="font-normal normal-case">(opcional)</span>
        </label>
        <input id="rate-label" className="input" maxLength={24} value={label} placeholder="Ej.: Oficial, MEP, Tarjeta" onChange={(e) => setLabel(e.currentTarget.value)} />
        <div className="mt-2 flex flex-wrap gap-2">
          {RATE_LABEL_SUGGESTIONS.map((s) => (
            <Chip key={s} selected={label === s} onClick={() => setLabel(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="rate-source" className="label">
          Valor
        </label>
        <select id="rate-source" className="input" value={autoSource ?? ''} onChange={(e) => changeSource(e.currentTarget.value)}>
          <option value="">Manual: lo escribo yo</option>
          {quoteSourcesFor(currency).map((id) => (
            <option key={id} value={id}>
              En vivo · {QUOTE_SOURCES[id].label}
            </option>
          ))}
        </select>
      </div>
      {autoSource ? (
        <div className="rounded-2xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/40">
          <p className="flex items-center gap-1.5 font-medium">
            <Zap className="size-4 text-indigo-600 dark:text-indigo-400" aria-hidden /> Se actualiza sola
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Usa el precio de venta de {QUOTE_SOURCES[autoSource].label}.
            {autoSource !== existing?.autoSource && ' Al guardar se trae el valor de hoy.'}
            {existing && ` Ahora: 1 ${currency} = $ ${formatRate(existing.arsPerUnit)}.`} Para escribirlo vos, elegí «Manual».
          </p>
          {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      ) : (
        <AmountInput
          id="rate-value"
          label={`Cuántos pesos vale 1 ${currency}`}
          size="md"
          currency="ARS"
          value={valueText}
          onChange={(v) => {
            setValueText(v);
            setError(undefined);
          }}
          error={error}
          placeholder="Ej.: 1.450"
        />
      )}
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 dark:bg-zinc-800/40">
        <span className="text-sm">
          <span className="font-medium">Usar por defecto</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">Se preselecciona al cargar un gasto en {currency}.</span>
        </span>
        <input type="checkbox" className="size-5 accent-indigo-600" checked={isDefault} onChange={(e) => setIsDefault(e.currentTarget.checked)} />
      </label>
      <div className={`grid gap-2 ${canDelete ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {canDelete && (
          <Button variant="danger-soft" onClick={() => void remove()} disabled={saving}>
            <Trash2 className="size-4" aria-hidden /> Eliminar
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

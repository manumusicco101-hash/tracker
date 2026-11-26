import { Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { budgetInBase } from '../../lib/currency';
import { centsToInputText, formatMoney, parseAmountInput } from '../../lib/money';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import { errorMessage } from '../../utils/download';
import { AmountInput } from '../quick-add/AmountInput';
import { Button } from '../ui/Button';
import { SettingsCard } from './SettingsCard';

/** Presupuesto mensual global (obligatorio), en la moneda base. */
export function BudgetSection() {
  const { settings, actions } = useAppData();
  const toast = useToast();
  const base = settings.baseCurrency;
  const currentInBase = budgetInBase(settings.budget, settings);
  const [text, setText] = useState(centsToInputText(Math.round(currentInBase * 100)));
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setText(centsToInputText(Math.round(budgetInBase(settings.budget, settings) * 100)));
  }, [settings]);

  const parsed = parseAmountInput(text);
  const dirty = parsed !== Math.round(currentInBase * 100);

  const save = async () => {
    if (parsed === null || parsed <= 0) {
      setError('El presupuesto mensual tiene que ser mayor a cero.');
      return;
    }
    try {
      await actions.updateSettings({ budget: { amountCents: parsed, currency: base } });
      toast.show({ message: `Presupuesto mensual: ${formatMoney(parsed / 100, base)}`, tone: 'success' });
    } catch (err) {
      toast.show({ message: errorMessage(err), tone: 'error' });
    }
  };

  return (
    <SettingsCard id="budget-title" title="Presupuesto mensual" description="Tope global para todos tus gastos del mes." icon={<Target className="size-5" />}>
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="min-w-0 flex-1">
          <AmountInput
            id="global-budget"
            label="Presupuesto mensual"
            size="md"
            currency={base}
            value={text}
            onChange={(v) => {
              setText(v);
              setError(undefined);
            }}
            error={error}
          />
        </div>
        <Button type="submit" disabled={!dirty} className="mt-[1.375rem]">
          Guardar
        </Button>
      </form>
      {settings.budget.currency !== base && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Lo definiste en {settings.budget.currency}; se muestra convertido con la cotización actual.
        </p>
      )}
    </SettingsCard>
  );
}

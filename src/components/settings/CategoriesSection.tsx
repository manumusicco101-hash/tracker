import { Check, ChevronRight, Lock, Plus, Shapes, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_COLORS, OTHER_CATEGORY_ID } from '../../data/defaults';
import { budgetInBase } from '../../lib/currency';
import { centsToInputText, formatMoney, parseAmountInput } from '../../lib/money';
import { useAppData } from '../../state/AppDataProvider';
import { useConfirm } from '../../state/ConfirmProvider';
import { useToast } from '../../state/ToastProvider';
import type { Category } from '../../types';
import { errorMessage } from '../../utils/download';
import { CATEGORY_ICON_KEYS, CATEGORY_ICONS } from '../icons/categoryIcons';
import { CategoryIcon } from '../icons/CategoryIcon';
import { AmountInput } from '../quick-add/AmountInput';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { SettingsCard } from './SettingsCard';

type EditorState = { mode: 'new' } | { mode: 'edit'; category: Category };

export function CategoriesSection() {
  const { categories, settings } = useAppData();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const base = settings.baseCurrency;

  return (
    <SettingsCard
      id="categories-title"
      title="Categorías y presupuestos"
      description="Nombre, color, ícono y presupuesto mensual opcional por categoría."
      icon={<Shapes className="size-5" />}
      action={
        <Button size="sm" variant="ghost" onClick={() => setEditor({ mode: 'new' })}>
          <Plus className="size-4" aria-hidden /> Nueva
        </Button>
      }
    >
      <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {categories.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setEditor({ mode: 'edit', category: c })}
              className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            >
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
              {c.budget && c.budget.amountCents > 0 && (
                <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{formatMoney(budgetInBase(c.budget, settings), base)}/mes</span>
              )}
              {c.isSystem && <Lock className="size-3.5 text-zinc-400" aria-label="Categoría de sistema" />}
              <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <CategoryEditorSheet state={editor} onClose={() => setEditor(null)} />
    </SettingsCard>
  );
}

function CategoryEditorSheet({ state, onClose }: { state: EditorState | null; onClose: () => void }) {
  return (
    <BottomSheet open={state !== null} onClose={onClose} title={state?.mode === 'edit' ? 'Editar categoría' : 'Nueva categoría'}>
      {state && <CategoryEditorForm key={state.mode === 'edit' ? state.category.id : 'new'} state={state} onDone={onClose} />}
    </BottomSheet>
  );
}

function CategoryEditorForm({ state, onDone }: { state: EditorState; onDone: () => void }) {
  const { categories, expenses, settings, actions } = useAppData();
  const toast = useToast();
  const confirm = useConfirm();
  const existing = state.mode === 'edit' ? state.category : null;
  const base = settings.baseCurrency;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]);
  const [icon, setIcon] = useState(existing?.icon ?? 'shopping-cart');
  const [budgetText, setBudgetText] = useState(
    existing?.budget && existing.budget.amountCents > 0 ? centsToInputText(Math.round(budgetInBase(existing.budget, settings) * 100)) : '',
  );
  const [errors, setErrors] = useState<{ name?: string; budget?: string }>({});

  const save = async () => {
    const trimmed = name.trim();
    const nextErrors: typeof errors = {};
    if (!trimmed) nextErrors.name = 'Poné un nombre.';
    else if (categories.some((c) => c.id !== existing?.id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      nextErrors.name = 'Ya existe una categoría con ese nombre.';
    }
    const budgetCents = budgetText.trim() ? parseAmountInput(budgetText) : 0;
    if (budgetCents === null) nextErrors.budget = 'Revisá el monto.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || budgetCents === null) return;

    try {
      await actions.saveCategory(
        {
          name: trimmed,
          color,
          icon,
          order: existing?.order ?? Math.max(0, ...categories.filter((c) => c.id !== OTHER_CATEGORY_ID).map((c) => c.order + 1)),
          budget: budgetCents > 0 ? { amountCents: budgetCents, currency: base } : null,
        },
        existing?.id,
      );
      toast.show({ message: existing ? 'Categoría actualizada' : 'Categoría creada', tone: 'success' });
      onDone();
    } catch (err) {
      toast.show({ message: errorMessage(err), tone: 'error' });
    }
  };

  const remove = async () => {
    if (!existing || existing.isSystem) return;
    const count = expenses.filter((e) => e.categoryId === existing.id).length;
    const ok = await confirm({
      title: `¿Eliminar "${existing.name}"?`,
      message:
        count > 0
          ? `Tiene ${count} ${count === 1 ? 'gasto' : 'gastos'}: ${count === 1 ? 'pasa' : 'pasan'} a la categoría "Otros".`
          : 'No tiene gastos asociados.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const moved = await actions.deleteCategory(existing.id);
      toast.show({ message: moved > 0 ? `Categoría eliminada · ${moved} gastos pasaron a Otros` : 'Categoría eliminada' });
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
      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} size="lg" />
        <div className="min-w-0 flex-1">
          <label htmlFor="category-name" className="label">
            Nombre
          </label>
          <input
            id="category-name"
            className="input"
            maxLength={30}
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
              setErrors((x) => ({ ...x, name: undefined }));
            }}
            placeholder="Ej.: Mascotas"
            aria-invalid={!!errors.name}
          />
        </div>
      </div>
      {errors.name && <p className="-mt-3 text-sm text-rose-600 dark:text-rose-400">{errors.name}</p>}

      <fieldset>
        <legend className="label">Color</legend>
        <div className="grid grid-cols-8 gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="grid aspect-square min-h-11 place-items-center rounded-full ring-offset-2 ring-offset-white transition-transform active:scale-90 dark:ring-offset-zinc-900"
              style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            >
              {color === c && <Check className="size-4 text-white" strokeWidth={3} aria-hidden />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Ícono</legend>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {CATEGORY_ICON_KEYS.map((key) => {
            const Icon = CATEGORY_ICONS[key].icon;
            const selected = key === icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                className={`grid aspect-square min-h-11 place-items-center rounded-xl border transition-colors ${
                  selected ? 'border-transparent text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
                style={selected ? { backgroundColor: color } : undefined}
                aria-label={CATEGORY_ICONS[key].label}
                aria-pressed={selected}
                title={CATEGORY_ICONS[key].label}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <AmountInput
          id="category-budget"
          label="Presupuesto mensual (opcional)"
          size="md"
          currency={base}
          value={budgetText}
          onChange={(v) => {
            setBudgetText(v);
            setErrors((x) => ({ ...x, budget: undefined }));
          }}
          error={errors.budget}
          placeholder="Sin presupuesto"
        />
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Dejalo vacío para no seguir un tope en esta categoría.</p>
      </div>

      <div className={`grid gap-2 ${existing && !existing.isSystem ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {existing && !existing.isSystem && (
          <Button variant="danger-soft" onClick={() => void remove()}>
            <Trash2 className="size-4" aria-hidden /> Eliminar
          </Button>
        )}
        <Button type="submit">Guardar</Button>
      </div>
      {existing?.isSystem && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">"Otros" no se puede eliminar: recibe los gastos de las categorías que borres.</p>
      )}
    </form>
  );
}

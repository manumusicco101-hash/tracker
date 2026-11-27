import { Coins, Info, Monitor, Moon, Palette, Sun, TriangleAlert } from 'lucide-react';
import { BudgetSection } from '../components/settings/BudgetSection';
import { CategoriesSection } from '../components/settings/CategoriesSection';
import { DataSection } from '../components/settings/DataSection';
import { QuickAddSection } from '../components/settings/QuickAddSection';
import { RatesSection } from '../components/settings/RatesSection';
import { SettingsCard } from '../components/settings/SettingsCard';
import { setViewportDebug, useViewportDebug } from '../components/layout/ViewportDebug';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SCHEMA_VERSION } from '../data/migrations';
import { BASE_CURRENCIES, CURRENCY_NAMES } from '../lib/currency';
import { THEME_LABELS } from '../lib/labels';
import { useAppData } from '../state/AppDataProvider';
import { useToast } from '../state/ToastProvider';
import type { BaseCurrency, ThemePreference } from '../types';
import { errorMessage } from '../utils/download';

const THEME_ICONS: Record<ThemePreference, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

export function SettingsScreen() {
  const { settings, persistent, actions } = useAppData();
  const toast = useToast();
  const viewportDebug = useViewportDebug();

  const update = async (patch: Parameters<typeof actions.updateSettings>[0], message?: string) => {
    try {
      await actions.updateSettings(patch);
      if (message) toast.show({ message, tone: 'success' });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
      </header>

      {!persistent && (
        <p className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Este navegador no permite guardar datos (¿modo privado?). Lo que cargues se pierde al cerrar la pestaña.
        </p>
      )}

      <SettingsCard id="theme-title" title="Apariencia" icon={<Palette className="size-5" />}>
        <SegmentedControl<ThemePreference>
          ariaLabel="Tema"
          value={settings.theme}
          onChange={(theme) => void update({ theme })}
          options={(['system', 'light', 'dark'] as const).map((t) => {
            const Icon = THEME_ICONS[t];
            return { value: t, label: THEME_LABELS[t], icon: <Icon className="size-4" aria-hidden /> };
          })}
        />
      </SettingsCard>

      <SettingsCard
        id="base-title"
        title="Moneda base"
        description="Todos los totales, gráficos y presupuestos se muestran en esta moneda."
        icon={<Coins className="size-5" />}
      >
        <SegmentedControl<BaseCurrency>
          ariaLabel="Moneda base"
          value={settings.baseCurrency}
          onChange={(baseCurrency) => void update({ baseCurrency }, `Ahora todo se muestra en ${CURRENCY_NAMES[baseCurrency].toLowerCase()}`)}
          options={BASE_CURRENCIES.map((c) => ({ value: c, label: `${c} · ${CURRENCY_NAMES[c]}` }))}
        />
      </SettingsCard>

      <QuickAddSection />
      <RatesSection />
      <BudgetSection />
      <CategoriesSection />
      <DataSection />

      <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-zinc-400 dark:text-zinc-500">
        <Info className="size-3.5" aria-hidden />
        Gastos v{__APP_VERSION__} ({__APP_BUILD__}) · esquema de datos v{SCHEMA_VERSION}
      </p>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setViewportDebug(!viewportDebug)}
          className="min-h-11 px-3 text-xs text-zinc-400 underline underline-offset-2 dark:text-zinc-500"
        >
          Diagnóstico de pantalla: {viewportDebug ? 'activado' : 'desactivado'}
        </button>
      </div>
    </div>
  );
}

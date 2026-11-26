import { Zap } from 'lucide-react';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import { errorMessage } from '../../utils/download';
import { ToggleRow } from '../ui/ToggleRow';
import { SettingsCard } from './SettingsCard';

/** Ajustes de la carga rápida: abrir el panel apenas se entra a la app. */
export function QuickAddSection() {
  const { settings, actions } = useAppData();
  const toast = useToast();

  const setOpenOnLaunch = async (openOnLaunch: boolean) => {
    try {
      await actions.updateSettings({ quickAdd: { ...settings.quickAdd, openOnLaunch } });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <SettingsCard id="quick-add-title" title="Carga rápida" description="Para anotar un gasto en pocos toques." icon={<Zap className="size-5" />}>
      <ToggleRow
        checked={settings.quickAdd.openOnLaunch}
        onChange={(value) => void setOpenOnLaunch(value)}
        title="Abrir el panel al entrar a la app"
        description="Apenas abrís la app aparece el panel para cargar un gasto. En iPhone hay que tocar el monto para que salga el teclado."
      />
      <details className="mt-3 rounded-2xl bg-zinc-50 px-3 text-sm dark:bg-zinc-800/40">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">Abrirla con el botón de acción del iPhone</summary>
        <div className="space-y-2 pb-3 text-zinc-600 dark:text-zinc-300">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Dejá activada la opción de arriba.</li>
            <li>
              En la app <span className="font-medium">Atajos</span> creá un atajo con la acción <span className="font-medium">Abrir app</span> y elegí{' '}
              <span className="font-medium">Gastos</span>.
            </li>
            <li>
              En Ajustes del iPhone → <span className="font-medium">Botón de acción</span> → Atajo, elegí ese atajo. Otra opción es Accesibilidad → Tocar →
              Tocar atrás.
            </li>
          </ol>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Si «Gastos» no aparece en la lista de apps, tu versión de iOS no deja abrir la app instalada desde un atajo. No uses «Abrir URLs»: abre Safari, que
            guarda los datos aparte de la app instalada.
          </p>
        </div>
      </details>
    </SettingsCard>
  );
}

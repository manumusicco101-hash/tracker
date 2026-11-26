import { Database, Download, FlaskConical, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { backupFileName, parseBackup, serializeBackup, summarizeBackup } from '../../data/backup';
import { formatNumericDate } from '../../lib/dates';
import { useAppData } from '../../state/AppDataProvider';
import { useConfirm } from '../../state/ConfirmProvider';
import { useToast } from '../../state/ToastProvider';
import { downloadTextFile, errorMessage, readFileAsText } from '../../utils/download';
import { Button } from '../ui/Button';
import { SettingsCard } from './SettingsCard';

export function DataSection() {
  const { expenses, today, actions } = useAppData();
  const confirm = useConfirm();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const sampleCount = expenses.filter((e) => e.isSample).length;

  const exportBackup = async () => {
    try {
      const file = await actions.exportBackup();
      downloadTextFile(backupFileName(today), serializeBackup(file), 'application/json');
      toast.show({ message: 'Backup descargado', tone: 'success' });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  const importBackup = async (file: File) => {
    setBusy(true);
    try {
      const backup = parseBackup(await readFileAsText(file));
      const summary = summarizeBackup(backup);
      const ok = await confirm({
        title: '¿Reemplazar todos tus datos?',
        message: (
          <>
            <p>
              El backup del {formatNumericDate(summary.exportedOn)} tiene {summary.expenses} gastos
              {summary.samples > 0 ? ` (${summary.samples} de ejemplo)` : ''}, {summary.categories} categorías y {summary.rates} cotizaciones.
            </p>
            <p className="mt-2 font-medium text-zinc-800 dark:text-zinc-200">Se van a reemplazar los {expenses.length} gastos actuales y todos los ajustes.</p>
          </>
        ),
        confirmLabel: 'Reemplazar',
        tone: 'danger',
      });
      if (!ok) return;
      await actions.importBackup(backup);
      toast.show({ message: `Backup importado: ${summary.expenses} gastos`, tone: 'success' });
    } catch (error) {
      toast.show({ message: `No se pudo importar: ${errorMessage(error)}`, tone: 'error', duration: 6000 });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeSamples = async () => {
    const ok = await confirm({
      title: '¿Borrar los datos de ejemplo?',
      message: `Se eliminan solo los ${sampleCount} gastos marcados como ejemplo. Lo que cargaste vos queda intacto.`,
      confirmLabel: 'Borrar ejemplos',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const count = await actions.removeSampleData();
      toast.show({ message: `Se borraron ${count} gastos de ejemplo`, tone: 'success' });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <SettingsCard
      id="data-title"
      title="Backup y datos"
      description="Tus datos viven en este navegador. Exportá un backup de vez en cuando."
      icon={<Database className="size-5" />}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => void exportBackup()}>
          <Download className="size-4" aria-hidden /> Exportar backup (JSON)
        </Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
          <Upload className="size-4" aria-hidden /> {busy ? 'Importando…' : 'Importar backup'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void importBackup(file);
          }}
        />
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Button variant="danger-soft" block onClick={() => void removeSamples()} disabled={sampleCount === 0}>
          <FlaskConical className="size-4" aria-hidden />
          {sampleCount > 0 ? `Borrar datos de ejemplo (${sampleCount})` : 'No hay datos de ejemplo'}
        </Button>
      </div>
    </SettingsCard>
  );
}

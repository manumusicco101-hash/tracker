import { useCallback } from 'react';
import { expenseTitle, toNewExpense } from '../lib/expenses';
import { useAppData } from '../state/AppDataProvider';
import { useConfirm } from '../state/ConfirmProvider';
import { useToast } from '../state/ToastProvider';
import type { Expense } from '../types';
import { errorMessage } from '../utils/download';

/**
 * Acciones con confirmación y "Deshacer" sobre un registro madre.
 * Eliminar una cuota u ocurrencia elimina la compra / serie completa, y se avisa antes.
 */
export function useExpenseActions() {
  const { actions, categoryName } = useAppData();
  const confirm = useConfirm();
  const toast = useToast();

  /** Devuelve true si se eliminó. */
  const deleteWithUndo = useCallback(
    async (e: Expense, beforeDelete?: () => void): Promise<boolean> => {
      const title = expenseTitle(e.note, categoryName(e.categoryId));
      if (e.kind !== 'single') {
        const ok = await confirm({
          title: e.kind === 'installments' ? '¿Eliminar la compra completa?' : '¿Eliminar toda la serie?',
          message:
            e.kind === 'installments'
              ? `Se eliminan las ${e.installments.count} cuotas de "${title}", incluidas las que ya pasaron.`
              : `Se elimina "${title}" con todas sus ocurrencias, también las pasadas del historial. Si solo querés que no se repita más, usá "Cancelar recurrente".`,
          confirmLabel: 'Eliminar',
          tone: 'danger',
        });
        if (!ok) return false;
      }
      beforeDelete?.();
      try {
        const removed = await actions.deleteExpense(e.id);
        if (removed) {
          toast.show({
            message: e.kind === 'single' ? 'Gasto eliminado' : `"${title}" eliminado por completo`,
            action: { label: 'Deshacer', onClick: () => void actions.restoreExpense(removed) },
            duration: 5000,
          });
        }
        return true;
      } catch (error) {
        toast.show({ message: errorMessage(error), tone: 'error' });
        return false;
      }
    },
    [actions, categoryName, confirm, toast],
  );

  /** Cancela una serie recurrente: frena las futuras y conserva las pasadas. */
  const cancelRecurringWithUndo = useCallback(
    async (e: Expense): Promise<boolean> => {
      if (e.kind !== 'recurring') return false;
      const ok = await confirm({
        title: '¿Cancelar este recurrente?',
        message: `"${expenseTitle(e.note, categoryName(e.categoryId))}" no se va a repetir más desde mañana. Las ocurrencias que ya pasaron siguen en el historial.`,
        confirmLabel: 'Cancelar recurrente',
        cancelLabel: 'Volver',
        tone: 'danger',
      });
      if (!ok) return false;
      try {
        await actions.cancelRecurring(e.id);
        toast.show({
          message: 'Recurrente cancelado',
          action: { label: 'Deshacer', onClick: () => void actions.updateExpense(e.id, toNewExpense(e)) },
          duration: 5000,
        });
        return true;
      } catch (error) {
        toast.show({ message: errorMessage(error), tone: 'error' });
        return false;
      }
    },
    [actions, categoryName, confirm, toast],
  );

  return { deleteWithUndo, cancelRecurringWithUndo };
}

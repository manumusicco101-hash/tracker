import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExpenseDetailSheet } from './components/expenses/ExpenseDetailSheet';
import { BottomNav } from './components/layout/BottomNav';
import { FabAdd } from './components/layout/FabAdd';
import { UpdatePrompt } from './components/layout/UpdatePrompt';
import { QuickAddSheet, type QuickAddHandle } from './components/quick-add/QuickAddSheet';
import { useHashRoute } from './hooks/useHashRoute';
import { useQuotesSync } from './hooks/useQuotesSync';
import { useApplyTheme } from './hooks/useTheme';
import { CommitmentsScreen } from './screens/CommitmentsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useAppData } from './state/AppDataProvider';
import { UIContext, type UIContextValue } from './state/UIContext';
import type { Occurrence } from './types';

interface DetailState {
  expenseId: string;
  occurrence?: Occurrence;
}

export function App() {
  const { settings } = useAppData();
  const [tab, navigate] = useHashRoute();
  const quickAdd = useRef<QuickAddHandle>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useApplyTheme(settings.theme);
  useQuotesSync();

  // Enlace directo (#/nuevo) u opción "Abrir el panel al entrar": al abrir la app aparece la carga rápida.
  // Solo corre al abrir, no cada vez que cambian los ajustes.
  useEffect(() => {
    const fromLink = /^#\/?nuevo$/.test(window.location.hash);
    if (fromLink) window.history.replaceState(null, '', '#/inicio');
    if (fromLink || settings.quickAdd.openOnLaunch) quickAdd.current?.openNew();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const closeDetail = useCallback(() => setDetailOpen(false), []);

  const ui = useMemo<UIContextValue>(
    () => ({
      openQuickAdd: () => quickAdd.current?.openNew(),
      openEditExpense: (expense) => quickAdd.current?.openEdit(expense),
      openExpenseDetail: (expenseId, occurrence) => {
        setDetail({ expenseId, occurrence });
        setDetailOpen(true);
      },
      navigate,
    }),
    [navigate],
  );

  return (
    <UIContext.Provider value={ui}>
      <div className="mx-auto min-h-dvh w-full max-w-2xl px-4" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'calc(env(safe-area-inset-bottom) + 9rem)' }}>
        <main>
          {tab === 'inicio' && <HomeScreen />}
          {tab === 'historial' && <HistoryScreen />}
          {tab === 'compromisos' && <CommitmentsScreen />}
          {tab === 'ajustes' && <SettingsScreen />}
        </main>
      </div>

      <FabAdd onPress={ui.openQuickAdd} />
      <BottomNav current={tab} onNavigate={navigate} />

      <ExpenseDetailSheet open={detailOpen} expenseId={detail?.expenseId ?? null} occurrence={detail?.occurrence} onClose={closeDetail} />
      <QuickAddSheet ref={quickAdd} />
      <UpdatePrompt />
    </UIContext.Provider>
  );
}

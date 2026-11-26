import { CalendarClock, History, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';
import type { TabId } from '../../hooks/useHashRoute';

const ITEMS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'compromisos', label: 'Compromisos', icon: CalendarClock },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
];

interface BottomNavProps {
  current: TabId;
  onNavigate: (tab: TabId) => void;
}

/** Navegación inferior fija con las 4 secciones. */
export function BottomNav({ current, onNavigate }: BottomNavProps) {
  return (
    <nav
      aria-label="Secciones"
      className="skin-glass fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/80 dark:border-zinc-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid h-16 max-w-2xl grid-cols-4">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = id === current;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium skin-press ${
                  active ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}>
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

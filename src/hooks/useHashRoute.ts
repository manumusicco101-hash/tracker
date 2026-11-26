import { useCallback, useEffect, useState } from 'react';

export type TabId = 'inicio' | 'historial' | 'compromisos' | 'ajustes';

export const TAB_IDS: TabId[] = ['inicio', 'historial', 'compromisos', 'ajustes'];

function readHash(): TabId {
  const value = window.location.hash.replace(/^#\/?/, '');
  return (TAB_IDS as string[]).includes(value) ? (value as TabId) : 'inicio';
}

/** Navegación por hash (#/historial): sin router, y el "atrás" vuelve a la sección anterior. */
export function useHashRoute(): [TabId, (tab: TabId) => void] {
  const [tab, setTab] = useState<TabId>(readHash);

  useEffect(() => {
    const onChange = () => setTab(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: TabId) => {
    if (next === readHash()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.location.hash = `/${next}`;
  }, []);

  return [tab, navigate];
}

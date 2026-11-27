import { useEffect, useState } from 'react';
import { viewportCompensation } from '../../lib/viewport';
import { readViewport } from '../../utils/visualViewport';

// Diagnóstico de pantalla: muestra arriba las medidas de la ventana y de lo visible, para poder
// mandar una captura si lo fijo (barra inferior, paneles) vuelve a quedar corrido en iOS.
// Se activa por dispositivo desde el pie de Ajustes y no toca los datos de la app.

const STORAGE_KEY = 'gastos-tracker:debug-viewport';
const CHANGE_EVENT = 'gastos-tracker:debug-viewport-change';

export function isViewportDebugOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setViewportDebug(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento: dura hasta recargar.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: on }));
}

/** Estado del diagnóstico que se actualiza si se cambia desde otro lado (pie de Ajustes). */
export function useViewportDebug(): boolean {
  const [on, setOn] = useState(isViewportDebugOn);
  useEffect(() => {
    const sync = (event: Event) => setOn((event as CustomEvent<boolean>).detail);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);
  return on;
}

function snapshot(): string[] {
  const metrics = readViewport();
  const { top, gap } = viewportCompensation(metrics);
  const nav = document.querySelector('nav[aria-label="Secciones"]')?.getBoundingClientRect();
  const ios = navigator.userAgent.match(/OS (\d+)_(\d+)(?:_(\d+))?/);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const round = (n: number | undefined) => (n === undefined ? '—' : Math.round(n * 10) / 10);
  return [
    `ventana ${round(metrics?.innerHeight ?? window.innerHeight)} · visible ${round(metrics?.height)} · corrida ${round(metrics?.offsetTop)} · zoom ${round(metrics?.scale)}`,
    `compensación arriba ${top} · abajo ${gap} · scroll ${Math.round(window.scrollY)} · barra hasta ${nav ? Math.round(nav.bottom) : '—'}`,
    `${ios ? `iOS ${ios.slice(1).filter(Boolean).join('.')}` : 'no iOS'} · ${standalone ? 'app instalada' : 'navegador'} · versión ${__APP_BUILD__}`,
  ];
}

export function ViewportDebug() {
  const on = useViewportDebug();
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!on) return;
    const update = () => setLines(snapshot());
    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    const tick = window.setInterval(update, 1000);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      window.clearInterval(tick);
    };
  }, [on]);

  if (!on) return null;

  return (
    <div className="vv-top pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-2" style={{ paddingTop: 'env(safe-area-inset-top)' }} aria-hidden>
      <div className="rounded-lg bg-black/80 px-2 py-1 font-mono text-[10px] leading-snug text-lime-300 tabular-nums">
        {lines.map((line) => (
          <p key={line.slice(0, 12)}>{line}</p>
        ))}
      </div>
    </div>
  );
}

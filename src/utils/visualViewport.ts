import { viewportCompensation, type ViewportMetrics } from '../lib/viewport';

/** Medidas actuales de la ventana y de lo visible, o null si el navegador no tiene visualViewport. */
export function readViewport(): ViewportMetrics | null {
  const viewport = window.visualViewport;
  if (!viewport) return null;
  return { innerHeight: window.innerHeight, height: viewport.height, offsetTop: viewport.offsetTop, scale: viewport.scale };
}

/**
 * Mantiene en <html> las variables --vv-top y --vv-gap con la compensación del bug de iOS 26
 * (ver src/lib/viewport.ts). Las clases .vv-top, .vv-bottom y .vv-fill de index.css las usan para
 * pegar lo fijo a los bordes visibles. Se instala una sola vez al arrancar.
 */
export function trackVisualViewport(): void {
  const root = document.documentElement.style;
  let last = '';
  const apply = () => {
    const { top, gap } = viewportCompensation(readViewport());
    const key = `${top}|${gap}`;
    if (key === last) return;
    last = key;
    root.setProperty('--vv-top', `${top}px`);
    root.setProperty('--vv-gap', `${gap}px`);
  };
  apply();
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', apply);
  viewport?.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  window.addEventListener('scroll', apply, { passive: true });
}

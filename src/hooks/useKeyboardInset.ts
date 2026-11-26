import { useEffect, useState } from 'react';

/**
 * Alto del teclado virtual en iOS (en px). Safari no achica el layout viewport al abrir
 * el teclado, así que un panel fijo abajo quedaría tapado: con este valor se sube.
 * En Android, con `interactive-widget=resizes-content` el layout ya se achica y da 0.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) {
      setInset(0);
      return;
    }
    const update = () => {
      const value = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(value > 80 ? Math.round(value) : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return inset;
}

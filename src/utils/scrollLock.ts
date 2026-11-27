// Bloqueo del scroll de la página mientras hay un panel abierto, pensado para iOS.
//
// En iOS no alcanza con `overflow: hidden` en el body: al enfocar un campo y abrirse el teclado,
// Safari desplaza igual la página. Por eso, mientras dura el bloqueo el body queda
// `position: fixed` en el mismo lugar y al soltarlo se vuelve a la posición guardada.
//
// El corrimiento de lo fijo que deja iOS 26 al cerrar el teclado no se arregla desde acá
// (moviendo el scroll no se reinicia): se compensa con src/utils/visualViewport.ts.

let locks = 0;
let savedScrollY = 0;

/** Bloquea el scroll de la página. Devuelve la función que lo suelta (se puede llamar más de una vez). */
export function lockPageScroll(): () => void {
  if (locks === 0) {
    savedScrollY = window.scrollY;
    const { style } = document.body;
    style.position = 'fixed';
    style.top = `-${savedScrollY}px`;
    style.left = '0';
    style.right = '0';
    style.width = '100%';
    style.overflow = 'hidden';
  }
  locks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks > 0) return;
    const { style } = document.body;
    style.position = '';
    style.top = '';
    style.left = '';
    style.right = '';
    style.width = '';
    style.overflow = '';
    window.scrollTo(0, savedScrollY);
  };
}

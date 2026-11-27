// Bloqueo del scroll de la página mientras hay un panel abierto, pensado para iOS.
//
// En iOS no alcanza con `overflow: hidden` en el body: al enfocar un campo y abrirse el
// teclado, Safari desplaza igual la página. Al cerrarse el teclado, la app instalada a veces
// deja lo fijo (barra inferior, paneles) corrido hasta el próximo scroll.
//
// Por eso, mientras dura el bloqueo el body queda `position: fixed` en el mismo lugar (no hay
// nada que desplazar) y al soltarlo se vuelve a la posición guardada. Cuando el teclado terminó
// de bajar, se mueve la página 1 px ida y vuelta para que iOS vuelva a ubicar lo fijo.

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
    settleAfterKeyboard();
  };
}

/** Espera a que baje el teclado (o 600 ms) y reacomoda la página para que lo fijo quede en su lugar. */
function settleAfterKeyboard(): void {
  const viewport = window.visualViewport;
  let done = false;
  let timer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    viewport?.removeEventListener('resize', onResize);
    window.clearTimeout(timer);
    if (locks > 0) return; // Se abrió otro panel mientras tanto: no se toca nada.
    const y = window.scrollY;
    window.scrollTo(0, y + 1);
    requestAnimationFrame(() => window.scrollTo(0, y));
  };

  function onResize() {
    // El teclado ya bajó cuando el área visible vuelve a ocupar casi toda la ventana.
    if (viewport && window.innerHeight - viewport.height < 80) finish();
  }

  viewport?.addEventListener('resize', onResize);
  timer = window.setTimeout(finish, 600);
}

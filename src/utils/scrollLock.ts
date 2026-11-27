// Bloqueo del scroll de la página mientras hay un panel abierto, y arreglos para iOS.
//
// En iOS no alcanza con `overflow: hidden` en el body: al enfocar un campo y abrirse el
// teclado, Safari desplaza igual la página. Por eso, mientras dura el bloqueo el body queda
// `position: fixed` en el mismo lugar y al soltarlo se vuelve a la posición guardada.
//
// Además, la app instalada a veces deja la vista corrida respecto de lo fijo después de cerrar
// el teclado (la barra inferior aparece más arriba y se ve contenido debajo). Eso se detecta
// con visualViewport.offsetTop > 0 sin teclado ni zoom, y se corrige desplazando la página hasta
// donde está la vista: el contenido no se mueve y lo fijo vuelve a su lugar.

let locks = 0;
let savedScrollY = 0;

/** Con el teclado abierto, la ventana visible es al menos esto más baja que la ventana completa. */
const KEYBOARD_MIN_HEIGHT = 80;

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

function keyboardOpen(viewport: VisualViewport): boolean {
  return window.innerHeight - viewport.height >= KEYBOARD_MIN_HEIGHT;
}

/**
 * Lleva la página hasta donde está la vista y la mueve 1 px ida y vuelta: así iOS vuelve a
 * ubicar lo fijo (barra inferior, paneles). No hace nada con zoom, con teclado o con un panel abierto.
 */
function realignViewport(): void {
  const viewport = window.visualViewport;
  if (locks > 0) return;
  if (viewport && (Math.abs(viewport.scale - 1) > 0.01 || keyboardOpen(viewport))) return;
  const target = Math.max(0, Math.round(window.scrollY + (viewport?.offsetTop ?? 0)));
  window.scrollTo(0, target + 1);
  requestAnimationFrame(() => window.scrollTo(0, target));
}

/** Espera a que baje el teclado (o 600 ms) y realinea la vista. Se repite un poco después por si iOS se reacomoda tarde. */
function settleAfterKeyboard(): void {
  const viewport = window.visualViewport;
  let done = false;
  let timer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    viewport?.removeEventListener('resize', onResize);
    window.clearTimeout(timer);
    realignViewport();
    window.setTimeout(() => {
      if (viewport && viewport.offsetTop > 1) realignViewport();
    }, 400);
  };

  function onResize() {
    if (viewport && !keyboardOpen(viewport)) finish();
  }

  viewport?.addEventListener('resize', onResize);
  timer = window.setTimeout(finish, 600);
}

/**
 * Red de seguridad para toda la app: si en algún momento la vista queda corrida sin teclado ni
 * zoom (el bug de iOS), se realinea. Se instala una sola vez al arrancar.
 */
export function watchViewportDrift(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;
  let timer = 0;
  const check = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (viewport.offsetTop > 1) realignViewport();
    }, 150);
  };
  viewport.addEventListener('resize', check);
  viewport.addEventListener('scroll', check);
}

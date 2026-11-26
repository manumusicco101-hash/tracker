import { useEffect, useRef } from 'react';

// Hace que el gesto / botón "atrás" de Android (y del navegador) cierre el panel
// o diálogo que esté arriba, en vez de salir de la app.
//
// Mientras haya al menos un overlay abierto existe UNA entrada extra en el historial.
// Al tocar "atrás" se consume esa entrada y se cierra el overlay de arriba; si quedan
// otros abiertos, se vuelve a agregar la entrada. Si un overlay se cierra desde la UI
// y era el último, se quita la entrada con history.back() (ignorando ese popstate).

interface Entry {
  id: number;
  close: () => void;
}

const stack: Entry[] = [];
let nextId = 1;
let markerActive = false;
let ignoredPops = 0;
let listening = false;

// Si la página se recargó con un panel abierto, la entrada marcada quedó en el historial:
// se limpia la marca para no confundirla con un panel abierto.
if (typeof window !== 'undefined' && window.history.state?.overlay) {
  const { overlay: _overlay, ...rest } = window.history.state as Record<string, unknown>;
  window.history.replaceState(Object.keys(rest).length > 0 ? rest : null, '');
}

function pushMarker() {
  window.history.pushState({ ...(window.history.state ?? {}), overlay: true }, '');
  markerActive = true;
}

function onPopState() {
  if (ignoredPops > 0) {
    ignoredPops -= 1;
    return;
  }
  if (!markerActive) return;
  markerActive = false;
  const top = stack.pop();
  if (stack.length > 0) pushMarker();
  top?.close();
}

function ensureListener() {
  if (listening) return;
  window.addEventListener('popstate', onPopState);
  listening = true;
}

export function useOverlayHistory(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    ensureListener();
    const id = nextId;
    nextId += 1;
    stack.push({ id, close: () => closeRef.current() });
    if (!markerActive) pushMarker();

    return () => {
      const index = stack.findIndex((e) => e.id === id);
      if (index === -1) return; // ya lo cerró el botón "atrás"
      stack.splice(index, 1);
      // Se espera al final del tick: si en el mismo render se abre otro overlay,
      // la entrada del historial se reutiliza.
      queueMicrotask(() => {
        if (stack.length === 0 && markerActive) {
          markerActive = false;
          ignoredPops += 1;
          window.history.back();
        }
      });
    };
  }, [open]);
}

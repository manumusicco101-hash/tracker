// Compensación del bug de iOS 26 en apps instaladas: al cerrarse el teclado, la vista puede quedar
// corrida dentro de la ventana (visualViewport.offsetTop no vuelve a 0). Lo fijo (barra inferior,
// botón +, paneles) se ubica respecto de la ventana, así que aparece corrido: la barra queda más
// arriba y debajo se ve contenido. Desde la página no se puede reiniciar ese corrimiento, pero sí
// medirlo y correr lo fijo la misma cantidad.

export interface ViewportMetrics {
  /** Alto de la ventana (layout viewport): window.innerHeight. */
  innerHeight: number;
  /** Alto de lo visible: visualViewport.height. */
  height: number;
  /** Cuánto está corrida hacia abajo lo visible dentro de la ventana: visualViewport.offsetTop. */
  offsetTop: number;
  /** Zoom: visualViewport.scale. */
  scale: number;
}

export interface ViewportCompensation {
  /** Cuánto bajar lo anclado arriba para que quede en el borde superior visible. */
  top: number;
  /** Cuánto bajar lo anclado abajo para que quede en el borde inferior visible. */
  gap: number;
}

/**
 * Cuánto correr lo fijo para que quede pegado a los bordes visibles.
 * - Normal: nada.
 * - Bug de iOS (vista corrida sin teclado): arriba y abajo bajan lo mismo que está corrida.
 * - Con el teclado abierto: lo de arriba sigue a la vista y lo de abajo no se mueve (queda detrás del teclado).
 * - Con zoom: nada, ese corrimiento lo hace la persona a propósito.
 */
export function viewportCompensation(metrics: ViewportMetrics | null): ViewportCompensation {
  if (!metrics || Math.abs(metrics.scale - 1) > 0.01) return { top: 0, gap: 0 };
  const top = Math.max(0, Math.round(metrics.offsetTop));
  const gap = Math.max(0, Math.round(metrics.offsetTop + metrics.height - metrics.innerHeight));
  return { top, gap };
}

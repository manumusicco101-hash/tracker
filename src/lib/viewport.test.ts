import { describe, expect, it } from 'vitest';
import { viewportCompensation } from './viewport';

describe('compensación de la vista (bug de iOS 26)', () => {
  it('sin corrimiento no mueve nada', () => {
    expect(viewportCompensation({ innerHeight: 800, height: 800, offsetTop: 0, scale: 1 })).toEqual({ top: 0, gap: 0 });
  });

  it('vista trabada después de cerrar el teclado: arriba y abajo bajan lo mismo', () => {
    expect(viewportCompensation({ innerHeight: 800, height: 800, offsetTop: 61, scale: 1 })).toEqual({ top: 61, gap: 61 });
  });

  it('con el teclado abierto, lo de abajo no se mueve y lo de arriba sigue a la vista', () => {
    expect(viewportCompensation({ innerHeight: 800, height: 450, offsetTop: 120, scale: 1 })).toEqual({ top: 120, gap: 0 });
    expect(viewportCompensation({ innerHeight: 800, height: 450, offsetTop: 0, scale: 1 })).toEqual({ top: 0, gap: 0 });
  });

  it('con zoom no compensa: el corrimiento es de la persona', () => {
    expect(viewportCompensation({ innerHeight: 800, height: 400, offsetTop: 200, scale: 2 })).toEqual({ top: 0, gap: 0 });
  });

  it('sin visualViewport o con el rebote del scroll no mueve nada', () => {
    expect(viewportCompensation(null)).toEqual({ top: 0, gap: 0 });
    expect(viewportCompensation({ innerHeight: 800, height: 800, offsetTop: -4, scale: 1 })).toEqual({ top: 0, gap: 0 });
  });

  it('redondea a píxeles enteros', () => {
    expect(viewportCompensation({ innerHeight: 800, height: 800.4, offsetTop: 60.6, scale: 1 })).toEqual({ top: 61, gap: 61 });
  });
});

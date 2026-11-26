import { describe, expect, it } from 'vitest';
import { fetchQuotes, type FetchLike } from './quotesApi';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const dolares = [
  { casa: 'oficial', venta: 1625, fechaActualizacion: '2026-11-26T18:00:00.000Z' },
  { casa: 'bolsa', venta: 1666.4, fechaActualizacion: '2026-11-26T20:56:00.000Z' },
];
const euro = { venta: 1759.0876, fechaActualizacion: '2026-11-26T17:54:00.000Z' };
const bluelytics = {
  oficial: { value_sell: 1620 },
  blue: { value_sell: 1700 },
  oficial_euro: { value_sell: 1786 },
  last_update: '2026-11-26T19:30:12-03:00',
};

/** Fetch falso: responde según un fragmento de la URL. */
function fakeFetch(routes: Record<string, () => Response | Promise<Response>>): FetchLike {
  return async (url) => {
    const key = Object.keys(routes).find((fragment) => url.includes(fragment));
    if (!key) throw new Error(`Sin ruta para ${url}`);
    return routes[key]();
  };
}

const fail = () => {
  throw new Error('sin conexión');
};

describe('fetchQuotes', () => {
  it('usa DolarApi con dólares y euro', async () => {
    const result = await fetchQuotes(fakeFetch({ '/v1/dolares': () => json(dolares), '/cotizaciones/eur': () => json(euro) }));
    expect(result.provider).toBe('dolarapi');
    expect(result.quotes['usd-oficial']?.sell).toBe(1625);
    expect(result.quotes['usd-mep']?.sell).toBe(1666.4);
    expect(result.quotes['eur-oficial']?.sell).toBe(1759.09);
  });

  it('si solo falla el euro, sigue con los dólares de DolarApi', async () => {
    const result = await fetchQuotes(fakeFetch({ '/v1/dolares': () => json(dolares), '/cotizaciones/eur': fail }));
    expect(result.provider).toBe('dolarapi');
    expect(result.quotes['usd-oficial']?.sell).toBe(1625);
    expect(result.quotes['eur-oficial']).toBeUndefined();
  });

  it('si DolarApi falla, usa Bluelytics', async () => {
    const result = await fetchQuotes(
      fakeFetch({ '/v1/dolares': fail, '/cotizaciones/eur': fail, bluelytics: () => json(bluelytics) }),
    );
    expect(result.provider).toBe('bluelytics');
    expect(result.quotes['usd-oficial']?.sell).toBe(1620);
    expect(result.quotes['usd-blue']?.sell).toBe(1700);
    expect(result.quotes['eur-oficial']?.sell).toBe(1786);
    expect(result.quotes['usd-mep']).toBeUndefined();
  });

  it('si DolarApi responde un error HTTP o datos que no entiende, usa Bluelytics', async () => {
    const result = await fetchQuotes(
      fakeFetch({ '/v1/dolares': () => json([], 200), '/cotizaciones/eur': () => json({}, 503), bluelytics: () => json(bluelytics) }),
    );
    expect(result.provider).toBe('bluelytics');
  });

  it('si no responde ningún servicio, falla con un mensaje claro', async () => {
    await expect(fetchQuotes(fakeFetch({ '/v1/dolares': fail, '/cotizaciones/eur': fail, bluelytics: fail }))).rejects.toThrow(
      'No pudimos consultar',
    );
  });

  it('corta la espera si un servicio no contesta', async () => {
    const hang: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('abortado')));
      });
    await expect(fetchQuotes(hang, 20)).rejects.toThrow('No pudimos consultar');
  });
});

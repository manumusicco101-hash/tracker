import { parseBluelytics, parseDolarApi, type Quotes } from '../lib/quotes';
import type { QuoteProvider } from '../types';

// Consulta de cotizaciones en vivo. Solo pide los precios: no se envía ningún dato de la persona.
// Primero DolarApi (trae oficial, MEP, tarjeta, blue… y euro); si falla, Bluelytics (oficial, blue y euro).

const DOLARAPI_USD = 'https://dolarapi.com/v1/dolares';
const DOLARAPI_EUR = 'https://dolarapi.com/v1/cotizaciones/eur';
const BLUELYTICS = 'https://api.bluelytics.com.ar/v2/latest';
const TIMEOUT_MS = 8_000;

export interface FetchedQuotes {
  quotes: Quotes;
  provider: QuoteProvider;
}

/** Lo mínimo que se usa de `fetch` (se reemplaza en los tests). */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function getJson(url: string, fetchFn: FetchLike, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`El servicio respondió ${response.status}.`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchQuotes(fetchFn: FetchLike = (url, init) => fetch(url, init), timeoutMs: number = TIMEOUT_MS): Promise<FetchedQuotes> {
  const [usd, eur] = await Promise.allSettled([getJson(DOLARAPI_USD, fetchFn, timeoutMs), getJson(DOLARAPI_EUR, fetchFn, timeoutMs)]);
  if (usd.status === 'fulfilled') {
    const quotes = parseDolarApi(usd.value, eur.status === 'fulfilled' ? eur.value : undefined);
    if (Object.keys(quotes).length > 0) return { quotes, provider: 'dolarapi' };
  }

  try {
    const quotes = parseBluelytics(await getJson(BLUELYTICS, fetchFn, timeoutMs));
    if (Object.keys(quotes).length > 0) return { quotes, provider: 'bluelytics' };
  } catch {
    // Sin respaldo: se informa abajo.
  }
  throw new Error('No pudimos consultar las cotizaciones. Seguimos con las últimas guardadas.');
}

import { useEffect, useRef } from 'react';
import { isQuoteStale } from '../lib/quotes';
import { useAppData } from '../state/AppDataProvider';

const MINUTE = 60_000;
/** Al abrir la app o volver a ella: se consulta si la última vez fue hace más que esto. */
const MAX_AGE_ON_RETURN = 5 * MINUTE;
/** Con la app abierta: se consulta cada tanto. */
const MAX_AGE_WHILE_OPEN = 30 * MINUTE;
/** Entre un intento y otro (aunque haya fallado) pasa al menos esto: no se insiste sin conexión. */
const MIN_GAP_BETWEEN_ATTEMPTS = 2 * MINUTE;

/**
 * Mantiene al día las cotizaciones en vivo mientras la app está abierta:
 * al entrar, al volver a la app o recuperar internet, y cada 30 minutos.
 * Los errores no molestan: se muestran en Ajustes → Cotizaciones y la app sigue con el último valor.
 */
export function useQuotesSync(): void {
  const { settings, actions } = useAppData();
  // Los efectos de abajo se montan una sola vez: leen siempre lo último desde acá.
  const latest = useRef({ settings, actions });
  latest.current = { settings, actions };
  const lastAttempt = useRef(0);

  useEffect(() => {
    const run = (maxAgeMs: number) => {
      const { settings: current, actions: currentActions } = latest.current;
      if (!current.quotes.autoUpdate) return;
      if (!current.rates.some((rate) => rate.autoSource)) return;
      const now = Date.now();
      if (now - lastAttempt.current < MIN_GAP_BETWEEN_ATTEMPTS) return;
      if (!isQuoteStale(current.quotes.lastSyncAt, now, maxAgeMs)) return;
      lastAttempt.current = now;
      currentActions.syncQuotes().catch(() => undefined);
    };

    const onReturn = () => {
      if (document.visibilityState === 'visible') run(MAX_AGE_ON_RETURN);
    };
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible') run(MAX_AGE_WHILE_OPEN);
    }, MINUTE);

    run(MAX_AGE_ON_RETURN);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('online', onReturn);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('online', onReturn);
    };
  }, []);
}

import { useEffect, useState } from 'react';
import { todayISO } from '../lib/dates';
import type { ISODate } from '../types';

/**
 * Fecha local de hoy. Se recalcula cada minuto y al volver a la app,
 * así "Hoy" / "Ayer" no quedan desfasados si la app queda abierta de un día para otro.
 */
export function useToday(): ISODate {
  const [today, setToday] = useState<ISODate>(() => todayISO());

  useEffect(() => {
    const check = () => setToday((prev) => {
      const now = todayISO();
      return now === prev ? prev : now;
    });
    const interval = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  return today;
}

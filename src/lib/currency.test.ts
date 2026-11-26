import { describe, expect, it } from 'vitest';
import { appliedFactor, budgetInBase, convert, currentRateTable, rateTableForOccurrence, rateValueAt } from './currency';
import { makeSettings, recurring, single } from './testing';

const table = { ARS: 1, USD: 1450, EUR: 1700 };

describe('conversión vía pivote ARS', () => {
  it('convierte a base ARS y a base USD con la misma tabla', () => {
    expect(convert(10, 'USD', 'ARS', table)).toBe(14_500);
    expect(convert(10, 'USD', 'USD', table)).toBe(10);
    expect(convert(29_000, 'ARS', 'USD', table)).toBe(20);
    expect(convert(10, 'EUR', 'USD', table)).toBeCloseTo(11.7241, 4);
    expect(appliedFactor('USD', 'ARS', table)).toBe(1450);
  });

  it('un gasto en USD con cotización Tarjeta sigue valiendo USD 10 en base USD', () => {
    const settings = makeSettings();
    const t = currentRateTable(settings.rates, 'USD', 'usd-tarjeta');
    expect(t).toEqual({ ARS: 1, USD: 1885, EUR: 1700 });
    expect(convert(10, 'USD', 'ARS', t)).toBe(18_850);
    expect(convert(10, 'USD', 'USD', t)).toBe(10);
  });

  it('usa la cotización por defecto si no se eligió otra', () => {
    expect(currentRateTable(makeSettings().rates)).toEqual(table);
  });

  it('convierte el presupuesto a la moneda base vigente', () => {
    const settings = makeSettings({ baseCurrency: 'USD', budget: { amountCents: 1_450_000_00, currency: 'ARS' } });
    expect(budgetInBase(settings.budget, settings)).toBe(1000);
  });
});

describe('historial de cotizaciones (recurrentes)', () => {
  const history = [
    { rateId: 'usd-tarjeta', date: '2026-10-01', arsPerUnit: 1700 },
    { rateId: 'usd-tarjeta', date: '2026-11-15', arsPerUnit: 1900 },
  ];

  it('toma el último valor con fecha ≤ a la pedida', () => {
    expect(rateValueAt(history, 'usd-tarjeta', '2026-09-30')).toBeNull();
    expect(rateValueAt(history, 'usd-tarjeta', '2026-10-01')).toBe(1700);
    expect(rateValueAt(history, 'usd-tarjeta', '2026-11-14')).toBe(1700);
    expect(rateValueAt(history, 'usd-tarjeta', '2026-12-01')).toBe(1900);
  });

  it('cada ocurrencia recurrente usa la cotización vigente en su fecha', () => {
    const settings = makeSettings({ rateHistory: history });
    const sub = recurring({ currency: 'USD', rateId: 'usd-tarjeta', rateAtCreation: { ARS: 1, USD: 1600, EUR: 1700 } });
    expect(rateTableForOccurrence(sub, '2026-09-28', settings).USD).toBe(1600); // sin historial → rateAtCreation
    expect(rateTableForOccurrence(sub, '2026-10-28', settings).USD).toBe(1700);
    expect(rateTableForOccurrence(sub, '2026-11-28', settings).USD).toBe(1900);
  });

  it('los gastos únicos siempre usan rateAtCreation', () => {
    const settings = makeSettings({ rateHistory: history });
    const e = single({ currency: 'USD', rateId: 'usd-tarjeta', rateAtCreation: { ARS: 1, USD: 1600, EUR: 1700 } });
    expect(rateTableForOccurrence(e, '2026-12-01', settings).USD).toBe(1600);
  });
});

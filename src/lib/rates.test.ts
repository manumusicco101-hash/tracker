import { describe, expect, it } from 'vitest';
import { deleteRate, rebaseExpenseRates, setDefaultRate, upsertRate } from './rates';
import { makeSettings, single } from './testing';

describe('cotizaciones', () => {
  it('actualizar un valor lo registra en el historial con la fecha de hoy', () => {
    const s = upsertRate(
      makeSettings(),
      { id: 'usd-tarjeta', currency: 'USD', label: 'Tarjeta', arsPerUnit: 1950, isDefault: false },
      '2026-11-25',
    );
    expect(s.rates.find((r) => r.id === 'usd-tarjeta')?.arsPerUnit).toBe(1950);
    expect(s.rateHistory).toEqual([{ rateId: 'usd-tarjeta', date: '2026-11-25', arsPerUnit: 1950 }]);
  });

  it('dos cambios el mismo día dejan un solo registro', () => {
    let s = makeSettings();
    s = upsertRate(s, { id: 'usd-oficial', currency: 'USD', label: 'Oficial', arsPerUnit: 1460, isDefault: true }, '2026-11-25');
    s = upsertRate(s, { id: 'usd-oficial', currency: 'USD', label: 'Oficial', arsPerUnit: 1470, isDefault: true }, '2026-11-25');
    expect(s.rateHistory).toEqual([{ rateId: 'usd-oficial', date: '2026-11-25', arsPerUnit: 1470 }]);
  });

  it('cambiar solo la etiqueta no agrega historial', () => {
    const s = upsertRate(makeSettings(), { id: 'usd-oficial', currency: 'USD', label: 'BNA', arsPerUnit: 1450, isDefault: true }, '2026-11-25');
    expect(s.rateHistory).toEqual([]);
  });

  it('mantiene una sola cotización por defecto por moneda', () => {
    const s = upsertRate(makeSettings(), { currency: 'USD', label: 'MEP', arsPerUnit: 1480, isDefault: true }, '2026-11-25');
    const usd = s.rates.filter((r) => r.currency === 'USD');
    expect(usd).toHaveLength(3);
    expect(usd.filter((r) => r.isDefault).map((r) => r.label)).toEqual(['MEP']);
    const back = setDefaultRate(s, 'usd-oficial');
    expect(back.rates.filter((r) => r.currency === 'USD' && r.isDefault).map((r) => r.id)).toEqual(['usd-oficial']);
  });

  it('no permite borrar la última cotización de una moneda', () => {
    expect(() => deleteRate(makeSettings(), 'eur-oficial')).toThrow();
    const s = deleteRate(makeSettings(), 'usd-oficial');
    expect(s.rates.find((r) => r.id === 'usd-tarjeta')?.isDefault).toBe(true);
  });

  it('recalcular todo toma la cotización actual de cada gasto', () => {
    const settings = makeSettings();
    const updates = rebaseExpenseRates(
      [
        single({ id: 'a', currency: 'ARS', rateAtCreation: { ARS: 1, USD: 1000, EUR: 1100 } }),
        single({ id: 'b', currency: 'USD', rateId: 'usd-tarjeta', rateAtCreation: { ARS: 1, USD: 1000, EUR: 1100 } }),
        single({ id: 'c', currency: 'USD', rateId: 'borrada', rateAtCreation: { ARS: 1, USD: 1000, EUR: 1100 } }),
      ],
      settings.rates,
    );
    expect(updates[0]).toEqual({ id: 'a', rateAtCreation: { ARS: 1, USD: 1450, EUR: 1700 } });
    expect(updates[1]).toEqual({ id: 'b', rateAtCreation: { ARS: 1, USD: 1885, EUR: 1700 }, rateId: 'usd-tarjeta', rateLabel: 'Tarjeta' });
    expect(updates[2].rateId).toBe('usd-oficial');
  });
});

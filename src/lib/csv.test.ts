import { describe, expect, it } from 'vitest';
import { buildHistoryCsv, csvFactor, csvNumber, csvText } from './csv';
import { expandOccurrences } from './occurrences';
import { installments, makeSettings, single } from './testing';

describe('CSV para Excel (es-AR)', () => {
  it('formatea números con coma y sin miles', () => {
    expect(csvNumber(1234.5)).toBe('1234,50');
    expect(csvNumber(-0.001)).toBe('0,00');
    expect(csvFactor(1450)).toBe('1450');
    expect(csvFactor(1 / 1450)).toBe('0,00069');
  });

  it('escapa separadores, comillas y fórmulas', () => {
    expect(csvText('Pan; leche')).toBe('"Pan; leche"');
    expect(csvText('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(csvText('=SUMA(A1)')).toBe("'=SUMA(A1)");
  });

  it('arma el archivo con BOM, ";" y columnas pedidas', () => {
    const settings = makeSettings();
    const occs = expandOccurrences(
      [
        single({ id: 'u', currency: 'USD', amountCents: 20_00, note: 'Café', rateAtCreation: { ARS: 1, USD: 1200, EUR: 1300 }, rateLabel: 'Tarjeta' }),
        installments({ installments: { count: 6, interest: 'none', financedTotalCents: 120_000_00, firstDue: 'next_month' } }),
      ],
      '2026-11-01',
      '2026-12-31',
      settings,
    );
    const csv = buildHistoryCsv(occs, { baseCurrency: 'ARS', categoryName: () => 'Alimentación' });
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(
      'Fecha;Descripción;Categoría;Método de pago;Monto original;Moneda;Cotización aplicada (ARS por unidad);Monto en ARS;Modalidad;Detalle',
    );
    // La fila informativa de la compra no se exporta: quedan el gasto en USD y la cuota 1/6 de diciembre.
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('25/11/2026;Café;Alimentación;Débito;20,00;USD;1200;24000,00;Único;Cotización Tarjeta');
    expect(lines[2]).toBe('10/12/2026;;Alimentación;Crédito;20000,00;ARS;1;20000,00;Cuota;Cuota 1/6');
  });
});

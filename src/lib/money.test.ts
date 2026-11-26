import { describe, expect, it } from 'vitest';
import { centsToInputText, formatAmountTyping, formatCode, formatMoney, formatNumber, parseAmountInput } from './money';

const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('parseAmountInput', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0,99', 99],
    ['1.234,', 123400],
    ['$ 2.500', 250000],
    ['  15000 ', 1500000],
  ])('%s → %d centavos', (input, cents) => {
    expect(parseAmountInput(input)).toBe(cents);
  });

  it.each(['', 'abc', '1,2,3', '12,345', '-5'])('%s es inválido', (input) => {
    expect(parseAmountInput(input)).toBeNull();
  });
});

describe('formato es-AR', () => {
  it('muestra miles con punto y decimales con coma', () => {
    expect(formatNumber(1234.56)).toBe('1.234,56');
    expect(formatNumber(24000)).toBe('24.000');
    expect(nbsp(formatMoney(1234.56, 'ARS'))).toBe('$ 1.234,56');
    expect(nbsp(formatMoney(20, 'USD'))).toBe('US$ 20');
    expect(formatCode(20, 'USD')).toBe('USD 20');
  });

  it('precarga inputs desde centavos', () => {
    expect(centsToInputText(123456)).toBe('1.234,56');
    expect(centsToInputText(123400)).toBe('1.234');
    expect(centsToInputText(5)).toBe('0,05');
    expect(parseAmountInput(centsToInputText(98765432))).toBe(98765432);
  });
});

describe('formatAmountTyping (formato en vivo)', () => {
  /** Simula tipear caracteres al final del input. */
  function typeSequence(chars: string): string {
    let value = '';
    for (const ch of chars) {
      const raw = value + ch;
      value = formatAmountTyping(raw, raw.length, ch).value;
    }
    return value;
  }

  it('agrupa miles mientras se escribe', () => {
    expect(typeSequence('1234567')).toBe('1.234.567');
  });

  it('toma "." o "," como separador decimal', () => {
    expect(typeSequence('1234.5')).toBe('1.234,5');
    expect(typeSequence('1234,56')).toBe('1.234,56');
    expect(typeSequence('1234,567')).toBe('1.234,56');
  });

  it('borrar un dígito reagrupa sin inventar decimales', () => {
    // "1.234" → backspace → "1.23" (crudo) → debe quedar "123"
    expect(formatAmountTyping('1.23', 4, null)).toEqual({ value: '123', caret: 3 });
  });

  it('",5" se completa como "0,5" y saca ceros a la izquierda', () => {
    expect(typeSequence(',5')).toBe('0,5');
    expect(typeSequence('007')).toBe('7');
  });

  it('mantiene el cursor en la posición equivalente', () => {
    // Insertar "9" después del "1" en "1.234" → "19.234", cursor después del 9.
    expect(formatAmountTyping('19.234', 2, '9')).toEqual({ value: '19.234', caret: 2 });
    // Insertar "5" al principio de "234" → "5234" → "5.234", cursor después del 5.
    expect(formatAmountTyping('5234', 1, '5')).toEqual({ value: '5.234', caret: 1 });
  });
});

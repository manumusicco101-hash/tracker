import { useCallback, useLayoutEffect, useRef, type Ref } from 'react';
import { centsToInputText, formatAmountTyping, parseAmountInput } from '../../lib/money';
import type { CurrencyCode } from '../../types';

const SYMBOLS: Record<CurrencyCode, string> = { ARS: '$', USD: 'US$', EUR: '€' };

interface AmountInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: CurrencyCode;
  inputRef?: Ref<HTMLInputElement>;
  size?: 'xl' | 'md';
  error?: string;
  placeholder?: string;
  /** Enter en el teclado (ej. guardar). */
  onEnter?: () => void;
}

/**
 * Input de monto en formato es-AR: agrupa miles con punto mientras se escribe y acepta
 * coma (o punto) como separador decimal. `inputMode="decimal"` abre el teclado numérico;
 * se usa type="text" porque type="number" rechaza la coma en varios navegadores.
 */
export function AmountInput({ id, label, value, onChange, currency, inputRef, size = 'xl', error, placeholder = '0', onEnter }: AmountInputProps) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      localRef.current = node;
      if (typeof inputRef === 'function') inputRef(node);
      else if (inputRef) inputRef.current = node;
    },
    [inputRef],
  );

  useLayoutEffect(() => {
    const input = localRef.current;
    if (pendingCaret.current === null || !input || document.activeElement !== input) return;
    input.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });

  const xl = size === 'xl';

  return (
    <div>
      <label htmlFor={id} className={xl ? 'sr-only' : 'label'}>
        {label}
      </label>
      <div
        className={`flex items-baseline gap-2 rounded-2xl border bg-white transition-colors focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:bg-zinc-800/60 ${
          error ? 'border-rose-400 dark:border-rose-500' : 'border-zinc-200 dark:border-zinc-700'
        } ${xl ? 'px-4 py-3' : 'px-3'}`}
      >
        <span className={`shrink-0 font-semibold text-zinc-400 ${xl ? 'text-2xl' : 'text-base'}`} aria-hidden>
          {SYMBOLS[currency]}
        </span>
        <input
          ref={setRefs}
          id={id}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          value={value}
          onChange={(event) => {
            const input = event.currentTarget;
            const native = event.nativeEvent as InputEvent;
            if (native.inputType === 'insertFromPaste' || native.inputType === 'insertReplacementText') {
              const cents = parseAmountInput(input.value);
              const next = cents === null ? formatAmountTyping(input.value, input.value.length, null).value : centsToInputText(cents);
              pendingCaret.current = next.length;
              onChange(next);
              return;
            }
            const inserted = native.inputType?.startsWith('insert') ? (native.data ?? null) : null;
            const result = formatAmountTyping(input.value, input.selectionStart ?? input.value.length, inserted);
            pendingCaret.current = result.caret;
            onChange(result.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onEnter) {
              event.preventDefault();
              onEnter();
            }
          }}
          className={`w-full min-w-0 bg-transparent font-semibold tabular-nums text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-50 dark:placeholder:text-zinc-600 ${
            xl ? 'h-12 text-4xl tracking-tight' : 'min-h-11 text-base'
          }`}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

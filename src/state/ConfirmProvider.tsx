import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog, type ConfirmOptions } from '../components/ui/ConfirmDialog';

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Diálogo de confirmación basado en promesas: `if (await confirm({...})) { ... }`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const onConfirm = useCallback(() => finish(true), [finish]);
  const onCancel = useCallback(() => finish(false), [finish]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog open={options !== null} options={options} onConfirm={onConfirm} onCancel={onCancel} />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm tiene que usarse dentro de <ConfirmProvider>.');
  return ctx;
}

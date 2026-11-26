import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useOverlayHistory } from '../../hooks/useOverlayHistory';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Acción a la derecha del encabezado (ej. "Guardar"), siempre visible aunque esté el teclado. */
  headerAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Mantener montado aunque esté cerrado (Quick Add: permite enfocar el input en el mismo toque). */
  keepMounted?: boolean;
  panelRef?: Ref<HTMLDivElement>;
  /** Clases extra para el contenedor del contenido. */
  bodyClassName?: string;
}

let openSheets = 0;

function lockBodyScroll(): () => void {
  openSheets += 1;
  document.body.style.overflow = 'hidden';
  return () => {
    openSheets -= 1;
    if (openSheets <= 0) {
      openSheets = 0;
      document.body.style.overflow = '';
    }
  };
}

const CLOSE_DRAG_DISTANCE = 110;

export function BottomSheet({
  open,
  onClose,
  title,
  headerAction,
  children,
  footer,
  keepMounted = false,
  panelRef,
  bodyClassName = '',
}: BottomSheetProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(open || keepMounted);
  const [shown, setShown] = useState(open && keepMounted);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useKeyboardInset(open);

  useOverlayHistory(open, onClose);

  // Montaje / desmontaje con transición de entrada y salida.
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Un panel que queda montado (Quick Add) vuelve a abrir desde arriba.
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
        bodyRef.current.scrollLeft = 0;
      }
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    setDragY(0);
    if (keepMounted) return;
    const timeout = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(timeout);
  }, [open, keepMounted]);

  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const visible = open && (shown || keepMounted);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
        tabIndex={-1}
        className="absolute inset-x-0 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl outline-none dark:bg-zinc-900"
        style={{
          bottom: keyboardInset,
          maxHeight: keyboardInset ? `calc(100dvh - ${keyboardInset}px - 1rem)` : undefined,
          transform: visible ? `translateY(${dragY}px)` : 'translateY(105%)',
          transition: dragStart.current ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          className="shrink-0 cursor-grab touch-none pt-2 active:cursor-grabbing"
          onPointerDown={(event) => {
            // Los botones del encabezado (cerrar, guardar) no inician el arrastre:
            // capturar el puntero haría que el clic no les llegue.
            if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
            dragStart.current = { y: event.clientY, t: performance.now() };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!dragStart.current) return;
            setDragY(Math.max(0, event.clientY - dragStart.current.y));
          }}
          onPointerUp={(event) => {
            if (!dragStart.current) return;
            const distance = event.clientY - dragStart.current.y;
            const velocity = distance / Math.max(1, performance.now() - dragStart.current.t);
            dragStart.current = null;
            if (distance > CLOSE_DRAG_DISTANCE || velocity > 0.8) onClose();
            setDragY(0);
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setDragY(0);
          }}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" aria-hidden />
          <div className="flex items-center gap-2 px-2 pt-1 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden />
            </button>
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-center text-base font-semibold">
              {title}
            </h2>
            <div className="flex min-w-11 shrink-0 justify-end">{headerAction}</div>
          </div>
        </div>
        <div ref={bodyRef} className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4 ${bodyClassName}`}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-zinc-100 px-4 pt-3 dark:border-zinc-800" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
        {!footer && <div className="shrink-0" style={{ height: 'env(safe-area-inset-bottom)' }} />}
      </div>
    </div>
  );
}

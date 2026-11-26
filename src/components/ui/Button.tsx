import type { ButtonHTMLAttributes, Ref } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft';
type Size = 'md' | 'sm' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-600/50 dark:bg-indigo-500 dark:hover:bg-indigo-400',
  secondary:
    'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
  ghost: 'text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400',
  'danger-soft': 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20',
};

// Todos los tamaños respetan el área táctil mínima de 44 px.
const SIZES: Record<Size, string> = {
  sm: 'min-h-11 px-3 text-sm rounded-xl gap-1.5',
  md: 'min-h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'min-h-12 px-5 text-base rounded-2xl gap-2',
};

export function Button({ variant = 'primary', size = 'md', block = false, className = '', type = 'button', ref, ...rest }: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
}

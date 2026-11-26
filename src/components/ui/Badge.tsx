import type { ReactNode } from 'react';

type Tone = 'neutral' | 'indigo' | 'cyan' | 'amber' | 'rose' | 'emerald';

const TONES: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

export function Badge({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap tabular-nums ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

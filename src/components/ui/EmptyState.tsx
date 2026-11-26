import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'gap-2 py-6' : 'gap-3 py-12'}`}>
      <span className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">{icon}</span>
      <div>
        <p className="font-medium text-zinc-800 dark:text-zinc-200">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

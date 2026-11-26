import type { ReactNode } from 'react';

interface SettingsCardProps {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}

export function SettingsCard({ id, title, description, icon, children, action }: SettingsCardProps) {
  return (
    <section className="card p-4" aria-labelledby={id}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="section-title">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

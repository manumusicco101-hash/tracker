import { getCategoryIcon } from './categoryIcons';

interface CategoryIconProps {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { box: 'size-8 rounded-xl', icon: 'size-4' },
  md: { box: 'size-10 rounded-2xl', icon: 'size-5' },
  lg: { box: 'size-12 rounded-2xl', icon: 'size-6' },
};

/** Ícono de categoría sobre un fondo suave de su color. */
export function CategoryIcon({ icon, color, size = 'md' }: CategoryIconProps) {
  const Icon = getCategoryIcon(icon);
  const s = SIZES[size];
  return (
    <span className={`grid shrink-0 place-items-center ${s.box}`} style={{ backgroundColor: `${color}22`, color }} aria-hidden>
      <Icon className={s.icon} strokeWidth={2.2} />
    </span>
  );
}

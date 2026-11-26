import { useEffect } from 'react';
import { mirrorThemePreference } from '../data/storage';
import type { ThemePreference } from '../types';

const THEME_COLORS = { light: '#f5f5f7', dark: '#000000' };

/** Aplica el tema (clase .dark en <html>) y sigue la preferencia del sistema si corresponde. */
export function useApplyTheme(preference: ThemePreference): void {
  useEffect(() => {
    mirrorThemePreference(preference);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && media.matches);
      const root = document.documentElement;
      root.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
}

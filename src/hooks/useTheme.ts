import { useState, useEffect } from 'react';
import { useSettings } from './useSettings';

export function useTheme() {
  const { settings, isLoaded } = useSettings();
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial value
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    // Listener for changes
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const effectiveTheme = settings.appearance === 'system' ? systemTheme : settings.appearance;

  return { effectiveTheme, isLoaded };
}

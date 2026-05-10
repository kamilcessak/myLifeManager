import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import { useThemePreferencesStore } from '../store/themePreferencesStore';
import { darkPalette, lightPalette, type AppColors } from './palette';

type ResolvedScheme = 'light' | 'dark';

type AppThemeContextValue = {
  colors: AppColors;
  isDark: boolean;
  resolvedScheme: ResolvedScheme;
  themePreference: 'light' | 'dark' | 'system';
  setThemePreference: (v: 'light' | 'dark' | 'system') => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function resolveAppearance(
  preference: 'light' | 'dark' | 'system',
  system: ColorSchemeName,
): ResolvedScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const themePreference = useThemePreferencesStore((s) => s.themePreference);
  const setThemePreference = useThemePreferencesStore((s) => s.setThemePreference);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() => Appearance.getColorScheme());

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const resolvedScheme = useMemo(
    () => resolveAppearance(themePreference, systemScheme),
    [themePreference, systemScheme],
  );

  const isDark = resolvedScheme === 'dark';
  const colors = isDark ? darkPalette : lightPalette;

  const value = useMemo(
    () => ({
      colors,
      isDark,
      resolvedScheme,
      themePreference,
      setThemePreference,
    }),
    [colors, isDark, resolvedScheme, themePreference, setThemePreference],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}

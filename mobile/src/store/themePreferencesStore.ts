import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mlm_theme_preference_v1';

interface ThemePreferencesState {
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => void;
}

export const useThemePreferencesStore = create<ThemePreferencesState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ themePreference: s.themePreference }),
    },
  ),
);

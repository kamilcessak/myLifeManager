import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = 'mlm_assignee_filter_only_mine';

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

interface AssigneeFilterState {
  onlyMine: boolean;
  setOnlyMine: (value: boolean) => void;
}

export const useAssigneeFilterStore = create<AssigneeFilterState>()(
  persist(
    (set) => ({
      onlyMine: false,
      setOnlyMine: (onlyMine) => set({ onlyMine }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ onlyMine: s.onlyMine }),
    },
  ),
);

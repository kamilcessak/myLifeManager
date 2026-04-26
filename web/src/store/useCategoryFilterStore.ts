import { create } from 'zustand';

export type CategoryFilter = 'all' | 'none' | string;

interface CategoryFilterState {
  activeCategoryFilter: CategoryFilter;
  setActiveCategoryFilter: (filter: CategoryFilter) => void;
}

export const useCategoryFilterStore = create<CategoryFilterState>((set) => ({
  activeCategoryFilter: 'all',
  setActiveCategoryFilter: (filter) => set({ activeCategoryFilter: filter }),
}));

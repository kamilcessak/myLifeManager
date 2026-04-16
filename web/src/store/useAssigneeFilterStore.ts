import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'mlm-assignee-filter';

interface AssigneeFilterState {
  /**
   * When `true`, list views (tasks, events) should filter by the currently
   * logged-in user via the API `assigneeId` parameter.
   *
   * This flag is ignored by components when the user is in a personal
   * workspace — the filter only makes sense inside a team workspace.
   */
  onlyMine: boolean;
  setOnlyMine: (next: boolean) => void;
  toggleOnlyMine: () => void;
}

export const useAssigneeFilterStore = create<AssigneeFilterState>()(
  persist(
    (set, get) => ({
      onlyMine: false,
      setOnlyMine: (next) => set({ onlyMine: next }),
      toggleOnlyMine: () => set({ onlyMine: !get().onlyMine }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ onlyMine: state.onlyMine }),
    },
  ),
);

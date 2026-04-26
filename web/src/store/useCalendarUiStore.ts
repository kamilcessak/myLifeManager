import { create } from 'zustand';

interface CalendarUiState {
  createTaskRequestId: number;
  todayRequestId: number;
  /** Bottom sheet zadania na mobile — ukrywa FAB, żeby nie nachodził na formularz */
  mobileTaskBottomSheetOpen: boolean;
  requestCreateTask: () => void;
  requestToday: () => void;
  setMobileTaskBottomSheetOpen: (open: boolean) => void;
}

export const useCalendarUiStore = create<CalendarUiState>((set) => ({
  createTaskRequestId: 0,
  todayRequestId: 0,
  mobileTaskBottomSheetOpen: false,
  requestCreateTask: () => set((state) => ({ createTaskRequestId: state.createTaskRequestId + 1 })),
  requestToday: () => set((state) => ({ todayRequestId: state.todayRequestId + 1 })),
  setMobileTaskBottomSheetOpen: (open) => set({ mobileTaskBottomSheetOpen: open }),
}));

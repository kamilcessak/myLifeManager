import { create } from 'zustand';

interface CalendarUiState {
  createTaskRequestId: number;
  todayRequestId: number;
  requestCreateTask: () => void;
  requestToday: () => void;
}

export const useCalendarUiStore = create<CalendarUiState>((set) => ({
  createTaskRequestId: 0,
  todayRequestId: 0,
  requestCreateTask: () => set((state) => ({ createTaskRequestId: state.createTaskRequestId + 1 })),
  requestToday: () => set((state) => ({ todayRequestId: state.todayRequestId + 1 })),
}));

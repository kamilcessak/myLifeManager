import { create } from 'zustand';

export type MobileNavTab = 'calendar' | 'categories' | 'search' | 'profile';

interface MobileNavState {
  activeTab: MobileNavTab;
  setActiveTab: (tab: MobileNavTab) => void;
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
  activeTab: 'calendar',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

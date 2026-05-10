import { create } from 'zustand';

interface WorkspaceState {
  activeWorkspaceId: string | null;
  setActiveWorkspace: (id: string | null) => void;
  resetWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: null,
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  resetWorkspace: () => set({ activeWorkspaceId: null }),
}));

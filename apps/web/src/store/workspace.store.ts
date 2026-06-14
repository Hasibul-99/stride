import { create } from 'zustand';

interface WorkspaceState {
  currentWorkspaceId: string | null;
  setCurrentWorkspace: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspaceId: null,
  setCurrentWorkspace: (id) => set({ currentWorkspaceId: id }),
}));

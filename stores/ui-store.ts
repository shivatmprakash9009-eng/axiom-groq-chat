import { create } from "zustand";

export type Appearance = "light" | "dark";
export type ChatStyle = "default" | "concise" | "detailed" | "code";

export interface WorkspaceSettings {
  chatStyle: ChatStyle;
  customSystemPrompt: string;
  temperature: number;
  streamResponses: boolean;
}

interface UIState {
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  appearance: Appearance;
  settingsModalOpen: boolean;
  shortcutsModalOpen: boolean;
  settings: WorkspaceSettings;
  stats: {
    totalMessages: number;
    totalPromptCharacters: number;
  };
  setSidebarOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleAppearance: () => void;
  setAppearance: (appearance: Appearance) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  updateSettings: (partial: Partial<WorkspaceSettings>) => void;
  incrementStats: (promptChars: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileSidebarOpen: false,
  appearance: "light",
  settingsModalOpen: false,
  shortcutsModalOpen: false,
  settings: {
    chatStyle: "default",
    customSystemPrompt: "",
    temperature: 0.6,
    streamResponses: true,
  },
  stats: {
    totalMessages: 0,
    totalPromptCharacters: 0,
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleAppearance: () =>
    set((state) => ({ appearance: state.appearance === "light" ? "dark" : "light" })),
  setAppearance: (appearance) => set({ appearance }),
  setSettingsModalOpen: (settingsModalOpen) => set({ settingsModalOpen }),
  setShortcutsModalOpen: (shortcutsModalOpen) => set({ shortcutsModalOpen }),
  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),
  incrementStats: (promptChars) =>
    set((state) => ({
      stats: {
        totalMessages: state.stats.totalMessages + 1,
        totalPromptCharacters: state.stats.totalPromptCharacters + promptChars,
      },
    })),
}));

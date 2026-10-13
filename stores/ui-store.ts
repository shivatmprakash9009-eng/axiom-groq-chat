import { create } from "zustand";

export type Appearance = "light" | "dark";

export const APPEARANCE_STORAGE_KEY = "axiom.appearance";

function readStoredAppearance(): Appearance | null {
  try {
    const saved = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

function storeAppearance(appearance: Appearance) {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice then lasts for this visit.
  }
}

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
  /** Applies the saved light/dark choice. Call once on the client after mount. */
  hydrateAppearance: () => void;
  setShortcutsModalOpen: (open: boolean) => void;
  updateSettings: (partial: Partial<WorkspaceSettings>) => void;
  incrementStats: (promptChars: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileSidebarOpen: false,
  appearance: "dark",
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
    set((state) => {
      const appearance: Appearance = state.appearance === "light" ? "dark" : "light";
      storeAppearance(appearance);
      return { appearance };
    }),
  setAppearance: (appearance) => {
    storeAppearance(appearance);
    set({ appearance });
  },
  hydrateAppearance: () => {
    const saved = readStoredAppearance();
    if (saved) set({ appearance: saved });
  },
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

import { create } from "zustand";

type Appearance = "light" | "dark";
type UIState = {
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  appearance: Appearance;
  setSidebarOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleAppearance: () => void;
  setAppearance: (appearance: Appearance) => void;
};

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileSidebarOpen: false,
  appearance: "light",
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleAppearance: () => set((state) => ({ appearance: state.appearance === "light" ? "dark" : "light" })),
  setAppearance: (appearance) => set({ appearance }),
}));

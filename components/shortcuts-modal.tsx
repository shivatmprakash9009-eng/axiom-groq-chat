"use client";

import { Command, X } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";

export function ShortcutsModal() {
  const open = useUIStore((state) => state.shortcutsModalOpen);
  const setOpen = useUIStore((state) => state.setShortcutsModalOpen);

  if (!open) return null;

  const shortcuts = [
    { key: "Enter", desc: "Send message" },
    { key: "Shift + Enter", desc: "Insert new line in composer" },
    { key: "⌘ / Ctrl + K", desc: "Focus conversation search" },
    { key: "⌘ / Ctrl + Shift + N", desc: "Start new conversation" },
    { key: "⌘ / Ctrl + Shift + E", desc: "Export current conversation" },
    { key: "⌘ / Ctrl + ,", desc: "Open workspace settings" },
    { key: "Escape", desc: "Dismiss modals and search" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <Command size={16} />
            </span>
            <h2 id="shortcuts-title" className="text-sm font-semibold text-[var(--text)]">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
          >
            <X size={17} />
          </button>
        </div>

        <div className="py-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg text-xs hover:bg-[var(--surface-soft)]"
            >
              <span className="text-[var(--text-secondary)]">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded-md border border-[var(--line)] bg-[var(--surface-soft)] text-[11px] font-mono font-medium text-[var(--text)] shadow-xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[var(--line)] flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[var(--text)] text-[var(--page)] hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

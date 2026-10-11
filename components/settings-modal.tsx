"use client";

import { Check, Sliders, Sparkles, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { type ChatStyle, useUIStore } from "@/stores/ui-store";

interface HealthInfo {
  ok: boolean;
  configured: boolean;
  activeProviders: string[];
  rateLimiter: string;
  version: string;
}

export function SettingsModal() {
  const open = useUIStore((state) => state.settingsModalOpen);
  const setOpen = useUIStore((state) => state.setSettingsModalOpen);
  const settings = useUIStore((state) => state.settings);
  const updateSettings = useUIStore((state) => state.updateSettings);
  const stats = useUIStore((state) => state.stats);

  const [health, setHealth] = useState<HealthInfo | null>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/health", { cache: "no-store" })
        .then((r) => r.json())
        .then((data: HealthInfo) => setHealth(data))
        .catch(() => setHealth(null));
    }
  }, [open]);

  if (!open) return null;

  const styleOptions: Array<{ id: ChatStyle; title: string; desc: string }> = [
    { id: "default", title: "Balanced", desc: "Thoughtful, structured, natural responses" },
    { id: "concise", title: "Concise", desc: "Minimalist, direct, strictly no fluff" },
    { id: "detailed", title: "In-depth", desc: "Exhaustive research, context, and edge cases" },
    { id: "code", title: "Engineering", desc: "Type-safe code, best practices, and architecture" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl transition-all">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <Sliders size={18} />
            </span>
            <h2 id="settings-title" className="text-base font-semibold text-[var(--text)]">
              Workspace Settings
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close settings"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-5 py-4 max-h-[70vh] overflow-y-auto">
          {/* Response Style Presets */}
          <div>
            <div className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2.5">
              Reasoning & Style Preset
            </div>
            <div className="grid grid-cols-2 gap-2">
              {styleOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateSettings({ chatStyle: opt.id })}
                  className={`flex flex-col text-left p-3 rounded-xl border text-xs transition-all ${
                    settings.chatStyle === opt.id
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm"
                      : "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  <span className="font-semibold flex items-center justify-between">
                    {opt.title}
                    {settings.chatStyle === opt.id && <Check size={14} />}
                  </span>
                  <span className="mt-1 text-[11px] opacity-75 leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom System Prompt */}
          <div>
            <label
              htmlFor="custom-system-prompt"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5"
            >
              Custom Instructions
            </label>
            <textarea
              id="custom-system-prompt"
              value={settings.customSystemPrompt}
              onChange={(e) => updateSettings({ customSystemPrompt: e.target.value })}
              placeholder="e.g., Always write concise answers in bullet points. Prefer TypeScript."
              className="w-full h-20 p-2.5 text-xs rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              maxLength={2000}
            />
            <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-1">
              <span>Appended to Axiom reasoning prompt</span>
              <span>{settings.customSystemPrompt.length}/2000</span>
            </div>
          </div>

          {/* Real-time Streaming */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)]">
            <div>
              <div className="text-xs font-medium text-[var(--text)] flex items-center gap-1.5">
                <Zap size={14} className="text-[var(--accent)]" />
                Real-Time Streaming
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Stream token responses continuously as they generate
              </div>
            </div>
            <input
              type="checkbox"
              id="streaming-toggle"
              checked={settings.streamResponses}
              onChange={(e) => updateSettings({ streamResponses: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--line)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
            />
          </div>

          {/* System Status & Metrics */}
          <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] space-y-2">
            <div className="text-xs font-semibold text-[var(--text)] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-[var(--accent)]" />
                SaaS System Diagnostics
              </span>
              <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                v{health?.version || "2.1.0"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <span className="text-[var(--text-tertiary)] block text-[10px]">Active Engine</span>
                <span className="font-semibold text-[var(--text)] capitalize">
                  {health?.activeProviders?.length ? health.activeProviders.join(", ") : "Multi-Provider Router"}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <span className="text-[var(--text-tertiary)] block text-[10px]">Rate Limiter</span>
                <span className="font-semibold text-[var(--text)] capitalize">
                  {health?.rateLimiter || "Sliding Window"}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <span className="text-[var(--text-tertiary)] block text-[10px]">Session Messages</span>
                <span className="font-semibold text-[var(--text)] font-mono">{stats.totalMessages}</span>
              </div>
              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <span className="text-[var(--text-tertiary)] block text-[10px]">Characters Processed</span>
                <span className="font-semibold text-[var(--text)] font-mono">{stats.totalPromptCharacters}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--line)] flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--text)] text-[var(--page)] hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

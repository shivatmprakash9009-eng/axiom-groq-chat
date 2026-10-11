"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
    setIsStandalone(standalone);

    const userAgent = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsStandalone(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isStandalone || dismissed || (!installEvent && !isIos)) return null;

  const install = async () => {
    if (!installEvent) {
      setShowIosHelp(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setDismissed(true);
    setInstallEvent(null);
  };

  return (
    <aside
      aria-label="Install TIWAT app"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/95 p-3 text-white shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:right-5"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
        <Download aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Get TIWAT as an app</p>
        <p className="text-xs text-zinc-400">Open it from your home screen.</p>
        {showIosHelp && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-300">
            In Safari, tap Share, then “Add to Home Screen”.
          </p>
        )}
      </div>
      <button
        className="shrink-0 rounded-full bg-white px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
        onClick={install}
        type="button"
      >
        {isIos ? "How to add" : "Install"}
      </button>
      <button
        aria-label="Dismiss install prompt"
        className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </aside>
  );
}

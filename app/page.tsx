import { Suspense } from "react";
import { ChatEntry } from "@/components/auth/chat-entry";
import { ChatWorkspace } from "@/components/chat-workspace";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell" aria-busy="true">
          <div
            className="main-panel"
            style={{ display: "grid", placeItems: "center", color: "var(--text-secondary)" }}
          >
            Loading TIWAT…
          </div>
        </main>
      }
    >
      <ChatEntry>
        <ChatWorkspace guestMode={false} />
      </ChatEntry>
    </Suspense>
  );
}

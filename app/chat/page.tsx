import { ChatEntry } from "@/components/auth/chat-entry";
import { ChatWorkspace } from "@/components/chat-workspace";
import { SettingsPage } from "@/components/settings-page";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string; settings?: string }>;
}) {
  const search = await searchParams;
  const guestMode = search.guest === "1";
  if (search.settings === "1") return <SettingsPage />;
  return <ChatEntry guestMode={guestMode}><ChatWorkspace guestMode={guestMode} /></ChatEntry>;
}

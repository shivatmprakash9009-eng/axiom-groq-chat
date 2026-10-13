import { ChatEntry } from "@/components/auth/chat-entry";
import { ChatWorkspace } from "@/components/chat-workspace";
import { SettingsPage } from "@/components/settings-page";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ settings?: string }>;
}) {
  const search = await searchParams;
  if (search.settings === "1") return <SettingsPage />;
  return <ChatEntry><ChatWorkspace /></ChatEntry>;
}

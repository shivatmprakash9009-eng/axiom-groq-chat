import { ChatEntry } from "@/components/auth/chat-entry";
import { ChatWorkspace } from "@/components/chat-workspace";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string }>;
}) {
  const search = await searchParams;
  const guestMode = search.guest === "1";
  return <ChatEntry guestMode={guestMode}><ChatWorkspace guestMode={guestMode} /></ChatEntry>;
}

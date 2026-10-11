import { ChatWorkspace } from "@/components/chat-workspace";
import { ChatEntry } from "@/components/auth/chat-entry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string }>;
}) {
  const search = await searchParams;
  const guestMode = search.guest === "1";

  if (!guestMode) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getClaims();
      if (error || !data?.claims?.sub) {
        return <ChatEntry guestMode={false}><ChatWorkspace guestMode={false} /></ChatEntry>;
      }
    } catch {
      return <ChatEntry guestMode={false}><ChatWorkspace guestMode={false} /></ChatEntry>;
    }
  }

  return <ChatEntry guestMode={guestMode}><ChatWorkspace guestMode={guestMode} /></ChatEntry>;
}

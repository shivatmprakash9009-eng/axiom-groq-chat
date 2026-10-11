import { redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string }>;
}) {
  const search = await searchParams;

  if (search.guest === "1") {
    return <ChatWorkspace guestMode />;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) redirect("/login");
  } catch {
    redirect("/login");
  }

  return <ChatWorkspace />;
}

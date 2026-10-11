import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims?.sub) redirect("/chat");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    // Supabase is intentionally optional at build time; show landing page until configured.
  }

  return redirect("/login");
}

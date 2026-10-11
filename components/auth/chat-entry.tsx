"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ChatEntry({ children, guestMode = false }: { children: React.ReactNode; guestMode?: boolean }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (guestMode) {
      setAllowed(true);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getClaims().then(({ data, error }) => {
        if (!error && data?.claims?.sub) setAllowed(true);
        else router.replace("/login");
      }).catch(() => router.replace("/login"));
    } catch {
      router.replace("/login");
    }
  }, [guestMode, router]);

  if (!allowed) {
    return <main className="auth-loading"><span className="auth-mark">T</span><p>Preparing your workspace…</p></main>;
  }

  return <>{children}</>;
}

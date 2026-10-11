"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function ChatEntry({ children, guestMode = false }: { children: React.ReactNode; guestMode?: boolean }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(guestMode);

  useEffect(() => {
    if (guestMode) {
      setAllowed(true);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
        if (user) setAllowed(true);
        else router.replace("/login");
      }, () => router.replace("/login"));
    } catch {
      router.replace("/login");
    }
    return () => unsubscribe?.();
  }, [guestMode, router]);

  if (!allowed) {
    return <main className="auth-loading"><span className="auth-mark">T</span><p>Preparing your workspace…</p></main>;
  }

  return <>{children}</>;
}

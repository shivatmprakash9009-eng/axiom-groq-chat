"use client";

import { GoogleAuthProvider, signInWithPopup } from "@firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function GoogleSignInButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setLoading(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace("/chat");
      router.refresh();
    } catch (caught) {
      const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "unknown";
      const detail = caught instanceof Error ? caught.message : "No additional error details.";
      const friendly = code === "auth/popup-closed-by-user"
        ? "Google sign-in was cancelled."
        : code === "auth/unauthorized-domain"
          ? "This domain is not authorized in Firebase Authentication settings."
          : code === "auth/operation-not-supported-in-this-environment"
            ? "This browser does not support popup sign-in. Open TIWAT in Chrome and try again."
            : code === "auth/popup-blocked"
              ? "The browser blocked the Google sign-in popup. Allow popups or open TIWAT in Chrome."
              : code === "auth/operation-not-allowed"
                ? "Google sign-in is disabled for this Firebase project."
                : "Google sign-in failed. Use the error code below to diagnose the exact cause.";
      setError(`${friendly} ( ${code}: ${detail} )`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="auth-google-button" type="button" onClick={signIn} disabled={loading}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.75 3.27-8.1Z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.16v2.84A11 11 0 0 0 12 23Z"/>
          <path fill="#FBBC05" d="M5.85 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.35-2.11V7.05H2.16A11 11 0 0 0 1 12c0 1.78.43 3.46 1.16 4.95l3.69-2.84Z"/>
          <path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.21 1.64l3.16-3.16C17.45 2.06 14.97 1 12 1a11 11 0 0 0-9.84 6.05l3.69 2.84C6.72 7.29 9.14 5.36 12 5.36Z"/>
        </svg>
        {loading ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {error && <p className="auth-alert" role="alert">{error}</p>}
    </>
  );
}

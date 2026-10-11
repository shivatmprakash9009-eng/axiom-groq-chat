"use client";

import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function AuthForm({ mode }: { mode: "signin" | "signup" | "reset" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const auth = getFirebaseAuth();
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email, {
          url: window.location.origin + "/login",
          handleCodeInApp: false,
        });
        setSuccess("If an account exists for that email, a password reset email has been sent.");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        await createUserWithEmailAndPassword(auth, email, password);
        router.replace("/chat");
        router.refresh();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        router.replace("/chat");
        router.refresh();
      }
    } catch (caught) {
      const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
      const message = code === "auth/email-already-in-use"
        ? "An account already exists for this email. Sign in instead."
        : code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
          ? "Email or password is incorrect."
          : code === "auth/weak-password"
            ? "Use a stronger password with at least 8 characters."
            : code === "auth/invalid-email"
              ? "Enter a valid email address."
              : caught instanceof Error && !code
                ? caught.message
                : "Authentication could not be completed. Please try again.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  const reset = mode === "reset";
  const signup = mode === "signup";

  return (
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="auth-alert" role="alert">{error}</div>}
      {success && <div className="auth-notice" role="status">{success}</div>}
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      {!reset && <>
        <div className="auth-label-row"><label htmlFor="password">Password</label></div>
        <input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : "Enter your password"} minLength={8} required />
      </>}
      {signup && <p className="auth-field-note">Use at least 8 characters for your password.</p>}
      <button className="auth-primary-button" type="submit" disabled={pending}>
        {pending ? "Please wait…" : reset ? "Send reset link" : signup ? "Create account" : "Sign in"} <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}

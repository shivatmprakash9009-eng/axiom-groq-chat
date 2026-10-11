"use client";

import { useActionState } from "react";
import { signInWithPassword, signUpWithPassword, requestPasswordReset, type AuthActionState } from "@/app/login/actions";

const initialState: AuthActionState = {};

export function AuthForm({ mode }: { mode: "signin" | "signup" | "reset" }) {
  const action = mode === "signup" ? signUpWithPassword : mode === "reset" ? requestPasswordReset : signInWithPassword;
  const [state, formAction, pending] = useActionState(action, initialState);
  const reset = mode === "reset";
  const signup = mode === "signup";

  return (
    <form className="auth-form" action={formAction}>
      {state.error && <div className="auth-alert" role="alert">{state.error}</div>}
      {state.success && <div className="auth-notice" role="status">{state.success}</div>}
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

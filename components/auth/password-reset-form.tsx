"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/app/login/actions";

export function PasswordResetForm() {
  const [state, formAction, pending] = useActionState(updatePassword, {} as AuthActionState);
  return (
    <form className="auth-form" action={formAction}>
      {state.error && <div className="auth-alert" role="alert">{state.error}</div>}
      <label htmlFor="password">New password</label>
      <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
      <label htmlFor="confirmPassword">Confirm new password</label>
      <input id="confirmPassword" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
      <button className="auth-primary-button" type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"} <span aria-hidden="true">→</span></button>
    </form>
  );
}

"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = { error?: string; success?: string };

export async function signInWithPassword(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "We could not sign you in. Check your credentials and try again." };
    redirect("/chat");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Authentication is temporarily unavailable. Please try again." };
  }
}

export async function signUpWithPassword(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) return { error: "Enter a valid email and a password with at least 8 characters." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://axiom-groq-chat.vercel.app"}/auth/callback` },
    });
    if (error) return { error: "We could not create your account. Check your details and try again." };
    if (data.session) redirect("/chat");
    return { success: "Check your inbox to confirm your email address." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Sign-up is temporarily unavailable. Please try again." };
  }
}

export async function requestPasswordReset(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email address first." };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://axiom-groq-chat.vercel.app"}/auth/callback?next=/reset-password`,
    });
    if (error) return { error: "We could not send the reset email. Check the address and try again." };
    return { success: "If an account exists for that email, a password reset link has been sent." };
  } catch {
    return { error: "Password reset is temporarily unavailable. Please try again." };
  }
}

export async function updatePassword(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");
  if (password.length < 8 || password !== confirm) return { error: "Passwords must match and contain at least 8 characters." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Your reset session has expired. Request a new reset email." };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "Password update failed. Please request a new reset link." };
    redirect("/chat");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Password update is temporarily unavailable. Please try again." };
  }
}

"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeMessage(message: string) {
  return message.slice(0, 220);
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect("/login?error=missing_credentials");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=sign_in_failed");
  redirect("/chat");
}

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) redirect("/login?error=invalid_signup");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://axiom-groq-chat.vercel.app"}/auth/callback` },
  });

  if (error) redirect("/login?error=signup_failed");
  if (data.session) redirect("/chat");
  redirect("/login?message=check_email");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) redirect("/login?error=missing_email");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://axiom-groq-chat.vercel.app"}/auth/callback?next=/reset-password`,
  });
  if (error) redirect("/login?error=reset_failed");
  redirect("/login?message=reset_email_sent");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");
  if (password.length < 8 || password !== confirm) redirect("/reset-password?error=invalid_password");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=reset_session_missing");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=update_failed");
  redirect("/chat");
}

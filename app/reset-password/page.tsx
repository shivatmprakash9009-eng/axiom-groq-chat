import Link from "next/link";
import { updatePassword } from "@/app/login/actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="auth-page auth-single-page">
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <Link href="/" className="auth-wordmark"><span className="auth-mark">T</span><span>TIWAT<span className="auth-period">.</span></span></Link>
          <div className="auth-top-note">ACCOUNT RECOVERY</div>
          <h2>Choose a new password</h2>
          <p className="auth-form-subtitle">Use at least 8 characters for your new password.</p>
          {error && <div className="auth-alert" role="alert">The reset session may be invalid or expired. Request another password reset email.</div>}
          <form className="auth-form" action={updatePassword}>
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
            <button className="auth-primary-button" type="submit">Update password <span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
        </div>
      </section>
    </main>
  );
}

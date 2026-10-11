import Link from "next/link";
import { signInWithPassword, signUpWithPassword, requestPasswordReset } from "./actions";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

type Search = Promise<{ error?: string; message?: string; mode?: string }>;

const messages: Record<string, string> = {
  missing_credentials: "Enter your email and password.",
  sign_in_failed: "We could not sign you in. Check your credentials and try again.",
  invalid_signup: "Enter an email and a password with at least 8 characters.",
  signup_failed: "We could not create your account. Try again or sign in.",
  missing_email: "Enter your email address first.",
  reset_failed: "We could not send the reset email. Check your address and try again.",
  oauth_callback: "Google sign-in could not be completed. Please try again.",
  reset_session_missing: "Your password reset session is missing or expired. Request a new reset email.",
};
const notices: Record<string, string> = {
  check_email: "Check your inbox to confirm your email address.",
  reset_email_sent: "If an account exists for that email, a password reset link has been sent.",
};

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const isSignup = search.mode === "signup";

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link href="/" className="auth-wordmark" aria-label="TIWAT home">
          <span className="auth-mark">T</span>
          <span>TIWAT<span className="auth-period">.</span></span>
        </Link>
        <div className="auth-brand-copy">
          <div className="auth-overline"><span /> YOUR THINKING SPACE</div>
          <h1>Think clearly.<br /><span>Move faster.</span></h1>
          <p>A calm, capable workspace for ideas, research, and work that matters.</p>
          <div className="auth-proof-row">
            <div className="auth-proof-icon">✳</div>
            <div><strong>One place for your next big idea.</strong><small>Focused tools. Clear thinking. Less friction.</small></div>
          </div>
        </div>
        <div className="auth-brand-bottom"><span>BUILT FOR CURIOSITY</span><span>© TIWAT</span></div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand"><span className="auth-mark">T</span><span>TIWAT<span className="auth-period">.</span></span></div>
        <div className="auth-form-wrap">
          <div className="auth-top-note">YOUR PERSONAL AI WORKSPACE</div>
          <h2>{isSignup ? "Create your account" : "Welcome back"}</h2>
          <p className="auth-form-subtitle">{isSignup ? "Start with a free personal workspace." : "Sign in to continue to your workspace."}</p>

          {search.error && <div className="auth-alert" role="alert">{messages[search.error] || "Something went wrong. Please try again."}</div>}
          {search.message && <div className="auth-notice" role="status">{notices[search.message] || "Check your email for the next step."}</div>}

          <GoogleSignInButton />

          <div className="auth-divider"><span /> <span>OR CONTINUE WITH EMAIL</span> <span /></div>

          <form className="auth-form" action={isSignup ? signUpWithPassword : signInWithPassword}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            <div className="auth-label-row"><label htmlFor="password">Password</label>{!isSignup && <Link href="/login?mode=reset">Forgot password?</Link>}</div>
            <input id="password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "At least 8 characters" : "Enter your password"} minLength={8} required />
            <button className="auth-primary-button" type="submit">{isSignup ? "Create account" : "Sign in"} <span aria-hidden="true">→</span></button>
          </form>

          {search.mode === "reset" && (
            <form className="auth-reset-form" action={requestPasswordReset}>
              <label htmlFor="reset-email">Reset password by email</label>
              <input id="reset-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              <button className="auth-secondary-button" type="submit">Send reset link</button>
            </form>
          )}

          <div className="auth-switch">
            {isSignup ? <>Already have an account? <Link href="/login">Sign in</Link></> : <>New to TIWAT? <Link href="/login?mode=signup">Create an account</Link></>}
          </div>
          <div className="auth-guest-separator"><span>OR</span></div>
          <Link className="auth-guest-button" href="/chat?guest=1">Continue as guest <span aria-hidden="true">↗</span></Link>
          <p className="auth-guest-note">Guest chats are temporary and are not saved to your account.</p>
          <p className="auth-terms">By continuing, you agree to use TIWAT responsibly. <Link href="/privacy">Privacy</Link></p>
        </div>
      </section>
    </main>
  );
}

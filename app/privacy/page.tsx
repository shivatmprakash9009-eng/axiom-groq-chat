import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="auth-single-page auth-page">
      <section className="auth-form-panel">
        <article className="auth-form-wrap privacy-copy">
          <Link href="/" className="auth-wordmark"><span className="auth-mark">T</span><span>TIWAT<span className="auth-period">.</span></span></Link>
          <div className="auth-top-note">YOUR DATA</div>
          <h2>Privacy at TIWAT</h2>
          <p className="auth-form-subtitle">A short explanation of how the current workspace is designed to handle your conversations.</p>
          <h3>Account conversations</h3>
          <p>When you sign in, TIWAT is designed to save your conversation history to your account in Supabase. Row-level security policies restrict access to chats owned by your account.</p>
          <h3>Guest sessions</h3>
          <p>Guest conversations are kept in the active browser session's memory and are not saved to your account database. Refreshing or leaving the guest workspace clears the in-memory history.</p>
          <h3>AI processing</h3>
          <p>Messages you send are transmitted to the configured AI provider to generate a response. Do not send passwords, API keys, or other secrets as chat messages.</p>
          <h3>Current status</h3>
          <p>This notice describes the intended app behavior. Authentication, database persistence, and provider settings must be configured and verified before production launch.</p>
          <p className="auth-switch"><Link href="/">Back to TIWAT</Link></p>
        </article>
      </section>
    </main>
  );
}

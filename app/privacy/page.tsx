import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="auth-single-page auth-page">
      <section className="auth-form-panel">
        <article className="auth-form-wrap privacy-copy">
          <Link href="/" className="auth-wordmark"><span className="auth-mark">T</span><span>TIWAT<span className="auth-period">.</span></span></Link>
          <div className="auth-top-note">YOUR DATA</div>
          <h2>Privacy at TIWAT</h2>
          <p className="auth-form-subtitle">This page summarizes data handling in the current code. It is not legal advice or a substitute for a complete privacy notice tailored to your deployment.</p>

          <h3>Authentication</h3>
          <p>Account creation, Google sign-in, email/password sign-in, and password-reset emails are handled by Firebase Authentication. For signed-in chat requests, the server verifies the Firebase ID token before forwarding the request to an AI provider.</p>

          <h3>Conversation history</h3>
          <p>The current workspace stores conversation history in the browser's local storage. It does not currently synchronize conversations to a server-side account database or across devices. Conversations may remain in the browser profile after sign-out until chat history or site data is cleared. Anyone with access to the same unlocked browser profile may be able to view locally stored conversations.</p>

          <h3>Guest use</h3>
          <p>Guest requests do not include a Firebase user token. Guest conversations are not associated with a signed-in account, but the current workspace also stores chat history in browser local storage when guest mode is used. Do not use guest mode on a shared device if you need the local history to remain private; clear chat history and browser site data when appropriate.</p>

          <h3>AI processing and text attachments</h3>
          <p>Messages and the contents of supported text-file attachments are sent to the configured AI provider to generate a response. If a provider attempt fails, the router may try another configured provider, so more than one provider may receive a request. Each provider handles submitted data under its own terms and privacy policy. Do not submit passwords, API keys, authentication tokens, or sensitive information you are not authorized to share.</p>

          <h3>Optional analytics</h3>
          <p>If a PostHog key is configured, the application initializes PostHog with page-view, page-leave, autocapture, and session-recording features. The current configuration requests input masking, but deployment operators should review PostHog settings, consent requirements, retention, and data access before enabling analytics for public users.</p>

          <h3>Operational and third-party services</h3>
          <p>The application may process requests through the hosting provider, Firebase Authentication, one or more configured AI providers, and optional services such as Arcjet and PostHog. Those services may process technical data under their own policies and the configuration chosen by the deployment operator.</p>

          <h3>Control and deletion</h3>
          <p>Use the workspace's clear-history control to remove conversation history from the current app view and its local-storage key. Clearing browser site data also removes local app data. Export important conversations before deleting them. This local deletion is not a request to delete data held independently by a third-party provider.</p>

          <h3>For deployment operators</h3>
          <p>Before making a hosted instance available to the public, configure a complete privacy notice, analytics disclosure and consent flow where required, data-retention rules, access controls, and support contact appropriate to your organization and jurisdiction. This page describes the current implementation and may need revision if server-side conversation persistence or additional integrations are added.</p>

          <p className="auth-switch"><Link href="/">Back to TIWAT</Link></p>
        </article>
      </section>
    </main>
  );
}

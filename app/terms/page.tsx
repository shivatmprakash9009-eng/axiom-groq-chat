import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <header><Link href="/settings">← Back to settings</Link><span>TIWAT</span></header>
      <article>
        <p className="legal-eyebrow">LEGAL</p>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: October 13, 2026</p>
        <h2>Using TIWAT</h2>
        <p>By using TIWAT, you agree to use the service lawfully and responsibly. Do not use it to violate another person’s rights, distribute harmful content, or attempt to disrupt or gain unauthorized access to the service.</p>
        <h2>AI-generated responses</h2>
        <p>TIWAT uses configured third-party AI providers to generate responses. AI output may be inaccurate, incomplete, or outdated. Review important information independently and do not rely on AI output as the sole basis for high-impact decisions.</p>
        <h2>Accounts and security</h2>
        <p>Authentication is handled through Firebase Authentication. You are responsible for maintaining the security of the account you use to sign in.</p>
        <h2>Availability and third-party services</h2>
        <p>Features may depend on provider availability, account configuration, rate limits, and third-party terms. The service may change as the project develops.</p>
        <h2>Open-source license</h2>
        <p>The project source code is provided under the MIT License, subject to the terms in the repository’s LICENSE file. These service terms do not replace that software license.</p>
        <h2>Disclaimer</h2>
        <p>TIWAT is provided “as is” and “as available,” to the extent permitted by applicable law. No guarantee is made that the service will be uninterrupted, error-free, or suitable for a particular purpose.</p>
        <h2>Contact and updates</h2>
        <p>For questions or to report an issue, use the project’s public GitHub issue tracker. These terms may be updated as the project changes.</p>
        <p><a href="https://github.com/shivatmprakash9009-eng/axiom-groq-chat/issues" target="_blank" rel="noreferrer">Open the TIWAT issue tracker →</a></p>
        <footer><Link href="/privacy">Privacy policy</Link><Link href="/settings">Settings</Link></footer>
      </article>
    </main>
  );
}

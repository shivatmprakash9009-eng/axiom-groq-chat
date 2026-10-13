"use client";

import { onAuthStateChanged, signOut, type User } from "@firebase/auth";
import { ArrowLeft, Check, ChevronRight, Cpu, FileText, Globe2, HelpCircle, LockKeyhole, LogOut, Moon, Palette, ShieldCheck, SlidersHorizontal, Sparkles, Sun, UserRound, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { type ChatStyle, useUIStore } from "@/stores/ui-store";

const styles: Array<{ id: ChatStyle; title: string; detail: string; icon: typeof Sparkles }> = [
  { id: "default", title: "Balanced", detail: "Clear, thoughtful everyday answers.", icon: Sparkles },
  { id: "concise", title: "Concise", detail: "Short and direct answers.", icon: Zap },
  { id: "detailed", title: "In-depth", detail: "More context and step-by-step detail.", icon: SlidersHorizontal },
  { id: "code", title: "Engineering", detail: "Technical explanations and code.", icon: Cpu },
];

const languages = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "हिन्दी (Hindi)" },
  { value: "Hinglish", label: "Hinglish" },
];

function initials(user: User | null) {
  const label = user?.displayName || user?.email?.split("@")[0] || "T";
  return label.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "T";
}

export function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [language, setLanguage] = useState("English");
  const settings = useUIStore((state) => state.settings);
  const updateSettings = useUIStore((state) => state.updateSettings);
  const appearance = useUIStore((state) => state.appearance);
  const setAppearance = useUIStore((state) => state.setAppearance);
  const hydrateAppearance = useUIStore((state) => state.hydrateAppearance);
  const [appearanceReady, setAppearanceReady] = useState(false);

  useEffect(() => {
    hydrateAppearance();
    setAppearanceReady(true);
  }, [hydrateAppearance]);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
        setUser(nextUser);
        setAuthLoading(false);
      });
    } catch {
      setAuthLoading(false);
    }
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tiwat.preferences.v1");
      if (raw) {
        const data = JSON.parse(raw) as Partial<typeof settings> & { language?: string };
        updateSettings({
          ...(data.chatStyle ? { chatStyle: data.chatStyle } : {}),
          ...(typeof data.customSystemPrompt === "string" ? { customSystemPrompt: data.customSystemPrompt } : {}),
          ...(typeof data.temperature === "number" ? { temperature: data.temperature } : {}),
          ...(typeof data.streamResponses === "boolean" ? { streamResponses: data.streamResponses } : {}),
        });
        if (typeof data.language === "string" && languages.some((item) => item.value === data.language)) setLanguage(data.language);
      }
    } catch { /* Ignore invalid local preferences. */ }
  // Load browser preferences once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePreferences = () => {
    try {
      localStorage.setItem("tiwat.preferences.v1", JSON.stringify({ ...settings, language }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch { setSaved(false); }
  };

  const logout = async () => {
    try { await signOut(getFirebaseAuth()); } finally { router.replace("/login"); }
  };

  const scrollTo = (id: string) => {
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  return (
    <main className={`account-settings-page ${appearance === "dark" ? "theme-dark" : ""}`} style={appearanceReady ? undefined : { opacity: 0 }}>
      <header className="account-settings-top">
        <Link href="/chat" className="account-round-action" aria-label="Back to chat"><ArrowLeft size={23} /></Link>
        <div className="account-hero">
          <div className="account-avatar-edit">
            {user?.photoURL ? <Image src={user.photoURL} alt="" width={48} height={48} unoptimized referrerPolicy="no-referrer" /> : <span>{initials(user)}</span>}
          </div>
          <strong>{authLoading ? "Loading…" : user?.displayName || user?.email?.split("@")[0] || "Guest"}</strong>
        </div>
        <button type="button" className="account-round-action account-info-action" onClick={() => scrollTo("account-details")} aria-label="Account information">i</button>
      </header>

      <div className="account-settings-content">
        <section className="account-settings-group">
          <button type="button" className="account-setting-row" onClick={() => scrollTo("account-details")}><UserRound /><span><strong>Account</strong><small>{authLoading ? "Checking account…" : user?.email || "Guest session — sign in to connect your account"}</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => scrollTo("personalization")}><Sparkles /><span><strong>Personalization</strong><small>Base style and tone, custom instructions</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => scrollTo("language")}><Globe2 /><span><strong>Language</strong><small>{language}</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => scrollTo("appearance")}><Palette /><span><strong>Appearance</strong><small>{appearance === "dark" ? "Dark" : "Light"} theme</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => scrollTo("safety")}><ShieldCheck /><span><strong>Safety</strong><small>Responsible use and AI safety</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => scrollTo("privacy-center")}><LockKeyhole /><span><strong>Privacy center</strong><small>How your data is handled</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => scrollTo("help-center")}><HelpCircle /><span><strong>Help center</strong><small>Support and common questions</small></span><ChevronRight /></button>
          <Link href="/terms" className="account-setting-row"><FileText /><span><strong>Terms of service</strong><small>Terms for using TIWAT</small></span><ChevronRight /></Link>
          <Link href="/privacy" className="account-setting-row"><ShieldCheck /><span><strong>Privacy policy</strong><small>Privacy and data practices</small></span><ChevronRight /></Link>
          <a href="https://github.com/shivatmprakash9009-eng/axiom-groq-chat/blob/main/LICENSE" target="_blank" rel="noreferrer" className="account-setting-row"><FileText /><span><strong>License</strong><small>MIT License</small></span><ChevronRight /></a>
        </section>

        <section id="account-details" className="account-detail-section">
          <h2>Account</h2>
          <div className="account-detail-card">
            <div className="account-account-identity">
              <div className="account-detail-avatar">{user?.photoURL ? <Image src={user.photoURL} alt="" width={48} height={48} unoptimized referrerPolicy="no-referrer" /> : initials(user)}</div>
              <div><strong>{user?.displayName || user?.email?.split("@")[0] || "Guest account"}</strong><small>{user?.email || "Not signed in"}</small></div>
            </div>
            <div className="account-detail-line"><span>Display name</span><strong>{user?.displayName || "Not set"}</strong></div>
            <div className="account-detail-line"><span>Email address</span><strong>{user?.email || "Not linked"}</strong></div>
            <div className="account-detail-line"><span>Sign-in method</span><strong>{user?.providerData.map((p) => p.providerId === "google.com" ? "Google" : p.providerId === "password" ? "Email & password" : p.providerId).join(", ") || "Guest"}</strong></div>
            <div className="account-detail-line"><span>Email verification</span><strong>{user ? user.emailVerified ? "Verified" : "Not verified" : "Not signed in"}</strong></div>
            {!user && <Link className="account-primary-button" href="/login">Sign in</Link>}
            {user && <button className="account-secondary-button" type="button" onClick={() => void logout()}><LogOut size={16} /> Sign out</button>}
          </div>
        </section>

        <section id="personalization" className="account-detail-section">
          <h2>Personalization</h2>
          <div className="account-detail-card">
            <strong>Base style and tone</strong>
            <div className="account-style-grid">{styles.map((option) => { const Icon = option.icon; return <button type="button" key={option.id} className={`account-style-option ${settings.chatStyle === option.id ? "selected" : ""}`} onClick={() => updateSettings({ chatStyle: option.id })}><Icon size={17} /><span>{option.title}</span>{settings.chatStyle === option.id && <Check size={15} />}</button>; })}</div>
            <label className="account-field-label" htmlFor="account-custom-instructions">Custom instructions</label>
            <textarea id="account-custom-instructions" className="settings-textarea" maxLength={2000} rows={4} value={settings.customSystemPrompt} onChange={(e) => updateSettings({ customSystemPrompt: e.target.value })} placeholder="Tell TIWAT how you want replies written." />
            <button type="button" className="account-primary-button" onClick={savePreferences}>{saved ? <><Check size={15} /> Saved</> : "Save preferences"}</button>
          </div>
        </section>

        <section id="language" className="account-detail-section">
          <h2>Language</h2>
          <div className="account-detail-card">
            <strong>Response language preference</strong>
            <div className="account-style-grid">{languages.map((item) => <button type="button" key={item.value} className={`account-style-option ${language === item.value ? "selected" : ""}`} onClick={() => setLanguage(item.value)}><Globe2 size={17} /><span>{item.label}</span>{language === item.value && <Check size={15} />}</button>)}</div>
            <p className="account-setting-note">Save your preference. You can also request a language directly in any chat.</p>
            <button type="button" className="account-primary-button" onClick={savePreferences}>{saved ? "Saved" : "Save language"}</button>
          </div>
        </section>

        <section id="appearance" className="account-detail-section">
          <h2>Appearance</h2>
          <div className="account-detail-card">
            <div className="account-style-grid">
              <button className={`account-style-option ${appearance === "light" ? "selected" : ""}`} type="button" onClick={() => setAppearance("light")}><Sun size={17} /><span>Light</span>{appearance === "light" && <Check size={15} />}</button>
              <button className={`account-style-option ${appearance === "dark" ? "selected" : ""}`} type="button" onClick={() => setAppearance("dark")}><Moon size={17} /><span>Dark</span>{appearance === "dark" && <Check size={15} />}</button>
            </div>
          </div>
        </section>

        <section id="safety" className="account-detail-section">
          <h2>Safety</h2>
          <div className="account-detail-card"><div className="account-info-row"><ShieldCheck /><div><strong>Use AI thoughtfully</strong><p>AI responses can be inaccurate. Verify important information and do not enter passwords, API keys, or other sensitive secrets into chat.</p></div></div><div className="account-info-row"><LockKeyhole /><div><strong>Account security</strong><p>Sign-in is managed through Firebase Authentication. Keep access to your Google or email account secure.</p></div></div></div>
        </section>

        <section id="privacy-center" className="account-detail-section">
          <h2>Privacy center</h2>
          <div className="account-detail-card"><div className="account-info-row"><LockKeyhole /><div><strong>Conversation history</strong><p>Chat history is stored in this browser and is not currently synced across devices.</p></div></div><div className="account-info-row"><ShieldCheck /><div><strong>AI requests</strong><p>Messages are sent to the configured server-side AI provider to generate replies.</p></div></div><Link href="/privacy" className="account-inline-link">Open privacy policy <ChevronRight size={15} /></Link></div>
        </section>

        <section id="help-center" className="account-detail-section">
          <h2>Help center</h2>
          <div className="account-detail-card"><div className="account-info-row"><HelpCircle /><div><strong>Need help?</strong><p>For sign-in or app issues, check the project documentation and repository issue tracker.</p></div></div><a className="account-inline-link" href="https://github.com/shivatmprakash9009-eng/axiom-groq-chat/issues" target="_blank" rel="noreferrer">Open support issues <ChevronRight size={15} /></a></div>
        </section>

        <section id="terms" className="account-detail-section"><h2>Terms of service</h2><div className="account-detail-card"><p>Use TIWAT lawfully and responsibly. AI output may be incorrect; verify important decisions independently.</p><Link href="/terms" className="account-inline-link">Read terms of service <ChevronRight size={15} /></Link></div></section>
        <section id="privacy-policy" className="account-detail-section"><h2>Privacy policy</h2><div className="account-detail-card"><p>Review how account authentication, chat requests, and local conversation history work.</p><Link href="/privacy" className="account-inline-link">Read privacy policy <ChevronRight size={15} /></Link></div></section>

        <footer className="account-settings-footer"><span>TIWAT · Account settings</span><Link href="/chat">← Back to chat</Link></footer>
      </div>
    </main>
  );
}

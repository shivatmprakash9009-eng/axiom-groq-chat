"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { Archive, ArrowLeft, AudioLines, Bell, BookOpen, BriefcaseBusiness, ChartNoAxesColumn, Check, ChevronDown, ChevronRight, Cpu, HardDrive, LockKeyhole, LogOut, Megaphone, Monitor, Moon, Palette, Puzzle, Settings, ShieldCheck, SlidersHorizontal, Smile, Sparkles, Sun, UserRound, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { type ChatStyle, useUIStore } from "@/stores/ui-store";

const styles: Array<{ id: ChatStyle; title: string; detail: string; icon: typeof Sparkles }> = [
  { id: "default", title: "Balanced", detail: "Clear, thoughtful everyday answers.", icon: Sparkles },
  { id: "concise", title: "Concise", detail: "Short, direct answers with less filler.", icon: Zap },
  { id: "detailed", title: "In-depth", detail: "More context, steps, and edge cases.", icon: SlidersHorizontal },
  { id: "code", title: "Engineering", detail: "Technical answers and code-focused help.", icon: Cpu },
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
  const settings = useUIStore((state) => state.settings);
  const updateSettings = useUIStore((state) => state.updateSettings);
  const appearance = useUIStore((state) => state.appearance);
  const setAppearance = useUIStore((state) => state.setAppearance);

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
        const data = JSON.parse(raw) as Partial<typeof settings>;
        updateSettings({
          ...(data.chatStyle ? { chatStyle: data.chatStyle } : {}),
          ...(typeof data.customSystemPrompt === "string" ? { customSystemPrompt: data.customSystemPrompt } : {}),
          ...(typeof data.temperature === "number" ? { temperature: data.temperature } : {}),
          ...(typeof data.streamResponses === "boolean" ? { streamResponses: data.streamResponses } : {}),
        });
      }
    } catch { /* Ignore unavailable or invalid browser storage. */ }
  // Load saved preferences once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePreferences = () => {
    try {
      localStorage.setItem("tiwat.preferences.v1", JSON.stringify(settings));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch { setSaved(false); }
  };

  const logout = async () => {
    try { await signOut(getFirebaseAuth()); } finally { router.replace("/login"); }
  };

  return (
    <main className={`account-settings-page ${appearance === "dark" ? "theme-dark" : ""}`}>
      <header className="account-settings-top">
        <Link href="/chat" className="account-round-action" aria-label="Back to chat"><span aria-hidden="true">←</span></Link>
        <div className="account-hero">
          <button type="button" className="account-avatar-edit" aria-label="Profile photo from signed-in account">
            {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span>{initials(user)}</span>}
            <span className="account-edit-badge">✎</span>
          </button>
          <strong>{authLoading ? "Loading…" : user?.displayName || user?.email?.split("@")[0] || "Guest"}</strong>
        </div>
        <button type="button" className="account-round-action account-info-action" onClick={() => document.getElementById("account-information")?.scrollIntoView({ behavior: "smooth" })} aria-label="Account information">i</button>
      </header>

      <div className="account-settings-content">
        <section className="account-settings-group account-profile-group" id="account-information">
          <button type="button" className="account-setting-row account-profile-row" onClick={() => document.getElementById("profile-details")?.scrollIntoView({ behavior: "smooth" })}>
            <UserRound /><span><strong>Account</strong><small>{authLoading ? "Checking account…" : user?.email || "Guest session — sign in to connect your account"}</small></span><ChevronRight />
          </button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("workspace-details")?.scrollIntoView({ behavior: "smooth" })}>
            <BriefcaseBusiness /><span><strong>Workspace</strong><small>Personal</small></span><ChevronRight />
          </button>
          <button type="button" className="account-setting-row account-upgrade-row" onClick={() => document.getElementById("ai-preferences")?.scrollIntoView({ behavior: "smooth" })}>
            <Sparkles /><span><strong>Make TIWAT yours</strong><small>Explore your AI preferences</small></span><ChevronRight />
          </button>
        </section>

        <section className="account-settings-group">
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("ai-preferences")?.scrollIntoView({ behavior: "smooth" })}><Smile /><span><strong>Personalization</strong><small>Response style and custom instructions</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("memory-details")?.scrollIntoView({ behavior: "smooth" })}><BookOpen /><span><strong>Memory</strong><small>How chat history is stored</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("workspace-details")?.scrollIntoView({ behavior: "smooth" })}><Puzzle /><span><strong>Integrations</strong><small>Available workspace capabilities</small></span><ChevronRight /></button>
          <div className="account-setting-row account-accent-row"><Palette /><span><strong>Accent color</strong><small><i className="account-color-dot" /> Indigo · TIWAT brand</small></span><ChevronDown /></div>
        </section>

        <section className="account-settings-group">
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("general-details")?.scrollIntoView({ behavior: "smooth" })}><Settings /><span><strong>General</strong><small>Appearance and response behavior</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("usage-details")?.scrollIntoView({ behavior: "smooth" })}><ChartNoAxesColumn /><span><strong>Usage and limits</strong><small>Current workspace status</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("general-details")?.scrollIntoView({ behavior: "smooth" })}><Bell /><span><strong>Notifications</strong><small>Notification preferences</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("general-details")?.scrollIntoView({ behavior: "smooth" })}><AudioLines /><span><strong>Voice</strong><small>Voice input availability depends on your device</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("privacy-details")?.scrollIntoView({ behavior: "smooth" })}><ShieldCheck /><span><strong>Safety</strong><small>AI use and safety information</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("profile-details")?.scrollIntoView({ behavior: "smooth" })}><LockKeyhole /><span><strong>Security and login</strong><small>Account and sign-in status</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("workspace-details")?.scrollIntoView({ behavior: "smooth" })}><Monitor /><span><strong>Remote control</strong><small>Not enabled in this workspace</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("memory-details")?.scrollIntoView({ behavior: "smooth" })}><HardDrive /><span><strong>Storage</strong><small>Local browser data</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("privacy-details")?.scrollIntoView({ behavior: "smooth" })}><ShieldCheck /><span><strong>Privacy center</strong><small>Understand how your data is handled</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("memory-details")?.scrollIntoView({ behavior: "smooth" })}><Archive /><span><strong>History and data</strong><small>Chat history stays in this browser</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => document.getElementById("privacy-details")?.scrollIntoView({ behavior: "smooth" })}><Megaphone /><span><strong>Data controls</strong><small>Privacy and provider information</small></span><ChevronRight /></button>
        </section>

        <section id="profile-details" className="account-detail-section">
          <h2>Account details</h2>
          <div className="account-detail-card"><span>DISPLAY NAME</span><strong>{user?.displayName || "Not set"}</strong><span>EMAIL ADDRESS</span><strong>{user?.email || "Not linked"}</strong><span>SIGN-IN METHOD</span><strong>{user?.providerData.map((p) => p.providerId === "google.com" ? "Google" : p.providerId === "password" ? "Email & password" : p.providerId).join(", ") || "Guest"}</strong><span>EMAIL VERIFICATION</span><strong>{user ? user.emailVerified ? "Verified" : "Not verified" : "Not signed in"}</strong></div>
          {!user && <Link className="account-primary-button" href="/login">Sign in</Link>}
          {user && <button className="account-secondary-button" type="button" onClick={() => void logout()}><LogOut size={16} /> Sign out</button>}
        </section>

        <section id="ai-preferences" className="account-detail-section">
          <h2>Personalization</h2>
          <div className="account-detail-card">
            <strong>Response style</strong>
            <div className="account-style-grid">{styles.map((option) => { const Icon = option.icon; return <button type="button" key={option.id} className={`account-style-option ${settings.chatStyle === option.id ? "selected" : ""}`} onClick={() => updateSettings({ chatStyle: option.id })}><Icon size={17} /><span>{option.title}</span>{settings.chatStyle === option.id && <Check size={15} />}</button>; })}</div>
            <label className="account-field-label" htmlFor="account-custom-instructions">Custom instructions</label>
            <textarea id="account-custom-instructions" className="settings-textarea" maxLength={2000} rows={4} value={settings.customSystemPrompt} onChange={(e) => updateSettings({ customSystemPrompt: e.target.value })} placeholder="Tell TIWAT how you want replies written." />
            <label className="account-field-label" htmlFor="account-temperature">Creativity · {settings.temperature.toFixed(1)}</label>
            <input id="account-temperature" className="settings-range" type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={(e) => updateSettings({ temperature: Number(e.target.value) })} />
            <div className="account-toggle-row"><span><strong>Stream responses</strong><small>Display replies as they arrive.</small></span><button type="button" role="switch" aria-checked={settings.streamResponses} className={`settings-switch ${settings.streamResponses ? "on" : ""}`} onClick={() => updateSettings({ streamResponses: !settings.streamResponses })}><span /></button></div>
            <button type="button" className="account-primary-button" onClick={savePreferences}>{saved ? "Saved" : "Save preferences"}</button>
          </div>
        </section>

        <section id="general-details" className="account-detail-section">
          <h2>General</h2>
          <div className="account-detail-card">
            <strong>Appearance</strong>
            <div className="account-style-grid"><button className={`account-style-option ${appearance === "light" ? "selected" : ""}`} type="button" onClick={() => { setAppearance("light"); try { localStorage.setItem("axiom.appearance", "light"); } catch {} }}><Sun size={17} /><span>Light mode</span></button><button className={`account-style-option ${appearance === "dark" ? "selected" : ""}`} type="button" onClick={() => { setAppearance("dark"); try { localStorage.setItem("axiom.appearance", "dark"); } catch {} }}><Moon size={17} /><span>Dark mode</span></button></div>
          </div>
        </section>

        <section id="workspace-details" className="account-detail-section"><h2>Workspace</h2><div className="account-detail-card"><strong>Personal workspace</strong><p>TIWAT AI chat, response customization, and local conversation history.</p><small>Some services such as remote control and third-party plugins are not currently enabled.</small></div></section>
        <section id="usage-details" className="account-detail-section"><h2>Usage and limits</h2><div className="account-detail-card"><p>Requests are subject to the configured AI provider, its plan, and workspace rate limits. Live usage billing is not available on this page.</p></div></section>
        <section id="memory-details" className="account-detail-section"><h2>History and storage</h2><div className="account-detail-card"><p>Conversation history is stored locally in this browser. It is not currently synced across devices.</p></div></section>
        <section id="privacy-details" className="account-detail-section"><h2>Privacy & security</h2><div className="account-detail-card"><p>Firebase handles authentication. AI requests are sent to the configured server-side provider. Avoid submitting sensitive secrets or passwords in chat.</p><Link href="/privacy">Read privacy information →</Link></div></section>
        <footer className="account-settings-footer"><span>TIWAT · Account settings</span><Link href="/chat">← Back to chat</Link></footer>
      </div>
    </main>
  );
}

"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { ArrowLeft, Check, Cpu, LogOut, Moon, Palette, ShieldCheck, SlidersHorizontal, Sparkles, Sun, UserRound, Zap } from "lucide-react";
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
    <main className={`settings-page min-h-dvh ${appearance === "dark" ? "theme-dark" : ""}`}>
      <header className="settings-topbar">
        <Link href="/chat" className="settings-back-link"><ArrowLeft size={17} /> Back to workspace</Link>
        <Link href="/chat" className="settings-wordmark"><span className="settings-brand-mark">T</span><span>TIWAT<span className="settings-brand-dot">.</span></span></Link>
        <span className="settings-topbar-label">ACCOUNT & PREFERENCES</span>
      </header>
      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="settings-eyebrow">YOUR WORKSPACE</div><h1>Settings</h1><p>Make TIWAT feel like yours.</p>
          <nav className="settings-nav" aria-label="Settings sections">
            <a href="#profile" className="settings-nav-item active"><UserRound size={17} /> Profile</a>
            <a href="#ai" className="settings-nav-item"><SlidersHorizontal size={17} /> AI preferences</a>
            <a href="#appearance" className="settings-nav-item"><Palette size={17} /> Appearance</a>
            <a href="#privacy" className="settings-nav-item"><ShieldCheck size={17} /> Privacy & security</a>
          </nav>
          <div className="settings-sidebar-foot">Your preferences are stored in this browser.</div>
        </aside>
        <div className="settings-content">
          <section id="profile" className="settings-section">
            <div className="settings-section-heading"><div><span className="settings-section-kicker">ACCOUNT</span><h2>Your profile</h2><p>Your identity for the account currently signed in.</p></div></div>
            <div className="settings-profile-card">
              <div className="settings-avatar">{user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span>{initials(user)}</span>}</div>
              <div className="settings-profile-main">
                <div className="settings-profile-name">{authLoading ? "Loading profile…" : user?.displayName || user?.email?.split("@")[0] || "Guest workspace"}</div>
                <div className="settings-profile-email">{authLoading ? "Checking account…" : user?.email || "Not signed in"}</div>
                <div className="settings-profile-badges"><span className={`settings-status-pill ${user ? "" : "muted"}`}>{user ? <><Check size={12} /> Signed in</> : "Guest session"}</span>{user?.emailVerified && <span className="settings-status-pill">Email verified</span>}</div>
              </div>
              {user && <button type="button" className="settings-secondary-button" onClick={() => void logout()}><LogOut size={15} /> Sign out</button>}
            </div>
            <div className="settings-detail-grid">
              <div className="settings-detail-card"><span>DISPLAY NAME</span><strong>{authLoading ? "Loading…" : user?.displayName || "Not set"}</strong></div>
              <div className="settings-detail-card"><span>EMAIL ADDRESS</span><strong>{authLoading ? "Loading…" : user?.email || "Not linked"}</strong></div>
              <div className="settings-detail-card"><span>SIGN-IN METHOD</span><strong>{user?.providerData.map((p) => p.providerId === "google.com" ? "Google" : p.providerId === "password" ? "Email & password" : p.providerId).join(", ") || (user ? "Firebase account" : "Guest")}</strong></div>
              <div className="settings-detail-card"><span>SESSION</span><strong>{authLoading ? "Checking…" : user ? "Active" : "Guest access"}</strong></div>
            </div>
            {!user && !authLoading && <p className="settings-inline-note">Sign in to display your Google profile name, photo, and email. <Link href="/login">Sign in →</Link></p>}
          </section>

          <section id="ai" className="settings-section">
            <div className="settings-section-heading"><div><span className="settings-section-kicker">PERSONALIZATION</span><h2>AI preferences</h2><p>Choose how TIWAT responds to new messages.</p></div></div>
            <div className="settings-panel">
              <div className="settings-field-heading"><div><strong>Response style</strong><p>Set your default answer style.</p></div></div>
              <div className="settings-style-grid">{styles.map((option) => { const Icon = option.icon; const active = settings.chatStyle === option.id; return <button key={option.id} type="button" aria-pressed={active} className={`settings-style-card ${active ? "selected" : ""}`} onClick={() => updateSettings({ chatStyle: option.id })}><span className="settings-style-icon"><Icon size={17} /></span><strong>{option.title}</strong><span className="settings-style-description">{option.detail}</span>{active && <Check className="settings-style-check" size={15} />}</button>; })}</div>
              <div className="settings-divider" />
              <label className="settings-field-heading" htmlFor="custom-instructions"><div><strong>Custom instructions</strong><p>Tell TIWAT how you want responses written.</p></div><span className="settings-char-count">{settings.customSystemPrompt.length}/2000</span></label>
              <textarea id="custom-instructions" className="settings-textarea" maxLength={2000} rows={4} placeholder="Example: Be practical, explain technical terms, and use Hinglish when I do." value={settings.customSystemPrompt} onChange={(e) => updateSettings({ customSystemPrompt: e.target.value })} />
              <div className="settings-divider" />
              <div className="settings-field-heading"><div><strong>Creativity</strong><p>Lower is more predictable; higher is more varied.</p></div><span className="settings-value-pill">{settings.temperature.toFixed(1)}</span></div>
              <input className="settings-range" type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={(e) => updateSettings({ temperature: Number(e.target.value) })} aria-label="Creativity" />
              <div className="settings-range-labels"><span>Precise</span><span>Balanced</span><span>Creative</span></div>
              <div className="settings-divider" />
              <div className="settings-toggle-row"><div><strong>Stream responses</strong><p>Show the response as it is generated.</p></div><button type="button" role="switch" aria-checked={settings.streamResponses} className={`settings-switch ${settings.streamResponses ? "on" : ""}`} onClick={() => updateSettings({ streamResponses: !settings.streamResponses })}><span /></button></div>
              <div className="settings-save-row"><span className="settings-save-hint">Saved locally in this browser.</span><button type="button" className="settings-primary-button" onClick={savePreferences}>{saved ? <><Check size={15} /> Saved</> : "Save preferences"}</button></div>
            </div>
          </section>

          <section id="appearance" className="settings-section">
            <div className="settings-section-heading"><div><span className="settings-section-kicker">DISPLAY</span><h2>Appearance</h2><p>Choose a comfortable workspace theme.</p></div></div>
            <div className="settings-appearance-grid">
              <button type="button" onClick={() => { setAppearance("light"); try { localStorage.setItem("axiom.appearance", "light"); } catch {} }} className={`settings-appearance-card light ${appearance === "light" ? "selected" : ""}`}><Sun size={22} /><strong>Light</strong><span>Bright and focused</span>{appearance === "light" && <Check size={16} />}</button>
              <button type="button" onClick={() => { setAppearance("dark"); try { localStorage.setItem("axiom.appearance", "dark"); } catch {} }} className={`settings-appearance-card dark ${appearance === "dark" ? "selected" : ""}`}><Moon size={22} /><strong>Dark</strong><span>Easy on the eyes</span>{appearance === "dark" && <Check size={16} />}</button>
            </div>
          </section>

          <section id="privacy" className="settings-section">
            <div className="settings-section-heading"><div><span className="settings-section-kicker">YOUR DATA</span><h2>Privacy & security</h2><p>Understand where account and workspace data live.</p></div></div>
            <div className="settings-panel settings-privacy-list">
              <div className="settings-privacy-item"><ShieldCheck size={19} /><div><strong>Authentication</strong><p>Firebase manages sign-in. Profile information shown here comes from your current Firebase session.</p></div></div>
              <div className="settings-privacy-item"><UserRound size={19} /><div><strong>Conversation history</strong><p>Chat history is stored in this browser and is not synced to a cloud conversation database.</p></div></div>
              <div className="settings-privacy-item"><SlidersHorizontal size={19} /><div><strong>Preferences</strong><p>Use Save preferences to store response settings in this browser.</p></div></div>
              <Link href="/privacy" className="settings-privacy-link">Read privacy information →</Link>
            </div>
          </section>
          <footer className="settings-footer"><span>TIWAT · Think clearly. Move faster.</span><Link href="/chat">Return to workspace →</Link></footer>
        </div>
      </div>
    </main>
  );
}

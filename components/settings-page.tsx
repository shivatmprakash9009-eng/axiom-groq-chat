"use client";

import { onAuthStateChanged, signOut, type User } from "@firebase/auth";
import { ArrowLeft, Check, ChevronRight, Cpu, FileText, Globe2, HelpCircle, LockKeyhole, LogOut, Moon, Palette, ShieldCheck, SlidersHorizontal, Sparkles, Sun, UserRound, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  { value: "Bengali", label: "বাংলা (Bengali)" },
  { value: "Urdu", label: "اردو (Urdu)" },
  { value: "Tamil", label: "தமிழ் (Tamil)" },
  { value: "Telugu", label: "తెలుగు (Telugu)" },
  { value: "Marathi", label: "मराठी (Marathi)" },
  { value: "Gujarati", label: "ગુજરાતી (Gujarati)" },
  { value: "Kannada", label: "ಕನ್ನಡ (Kannada)" },
  { value: "Malayalam", label: "മലയാളം (Malayalam)" },
  { value: "Punjabi", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { value: "Odia", label: "ଓଡ଼ିଆ (Odia)" },
  { value: "Assamese", label: "অসমীয়া (Assamese)" },
  { value: "Maithili", label: "मैथिली (Maithili)" },
  { value: "Sanskrit", label: "संस्कृतम् (Sanskrit)" },
  { value: "Nepali", label: "नेपाली (Nepali)" },
  { value: "Sindhi", label: "سنڌي (Sindhi)" },
  { value: "Kashmiri", label: "कॉशुर (Kashmiri)" },
  { value: "Konkani", label: "कोंकणी (Konkani)" },
  { value: "Manipuri", label: "মৈতৈলোন্ (Manipuri)" },
  { value: "Bodo", label: "बड़ो (Bodo)" },
  { value: "Dogri", label: "डोगरी (Dogri)" },
  { value: "Santali", label: "ᱥᱟᱱᱛᱟᱲᱤ (Santali)" },
  { value: "Spanish", label: "Español (Spanish)" },
  { value: "French", label: "Français (French)" },
  { value: "German", label: "Deutsch (German)" },
  { value: "Portuguese", label: "Português (Portuguese)" },
  { value: "Italian", label: "Italiano (Italian)" },
  { value: "Dutch", label: "Nederlands (Dutch)" },
  { value: "Afrikaans", label: "Afrikaans" },
  { value: "Swedish", label: "Svenska (Swedish)" },
  { value: "Norwegian", label: "Norsk (Norwegian)" },
  { value: "Danish", label: "Dansk (Danish)" },
  { value: "Finnish", label: "Suomi (Finnish)" },
  { value: "Irish", label: "Gaeilge (Irish)" },
  { value: "Welsh", label: "Cymraeg (Welsh)" },
  { value: "Polish", label: "Polski (Polish)" },
  { value: "Czech", label: "Čeština (Czech)" },
  { value: "Slovak", label: "Slovenčina (Slovak)" },
  { value: "Croatian", label: "Hrvatski (Croatian)" },
  { value: "Serbian", label: "Српски (Serbian)" },
  { value: "Bulgarian", label: "Български (Bulgarian)" },
  { value: "Romanian", label: "Română (Romanian)" },
  { value: "Hungarian", label: "Magyar (Hungarian)" },
  { value: "Greek", label: "Ελληνικά (Greek)" },
  { value: "Russian", label: "Русский (Russian)" },
  { value: "Ukrainian", label: "Українська (Ukrainian)" },
  { value: "Turkish", label: "Türkçe (Turkish)" },
  { value: "Arabic", label: "العربية (Arabic)" },
  { value: "Hebrew", label: "עברית (Hebrew)" },
  { value: "Persian", label: "فارسی (Persian)" },
  { value: "Pashto", label: "پښتو (Pashto)" },
  { value: "Armenian", label: "Հայերեն (Armenian)" },
  { value: "Azerbaijani", label: "Azərbaycan dili (Azerbaijani)" },
  { value: "Kazakh", label: "Қазақша (Kazakh)" },
  { value: "Uzbek", label: "Oʻzbekcha (Uzbek)" },
  { value: "Mongolian", label: "Монгол (Mongolian)" },
  { value: "Chinese (Simplified)", label: "简体中文 (Chinese)" },
  { value: "Chinese (Traditional)", label: "繁體中文 (Chinese)" },
  { value: "Japanese", label: "日本語 (Japanese)" },
  { value: "Korean", label: "한국어 (Korean)" },
  { value: "Thai", label: "ไทย (Thai)" },
  { value: "Vietnamese", label: "Tiếng Việt (Vietnamese)" },
  { value: "Indonesian", label: "Bahasa Indonesia" },
  { value: "Malay", label: "Bahasa Melayu (Malay)" },
  { value: "Filipino", label: "Filipino" },
  { value: "Burmese", label: "မြန်မာ (Burmese)" },
  { value: "Khmer", label: "ខ្មែរ (Khmer)" },
  { value: "Lao", label: "ລາວ (Lao)" },
  { value: "Javanese", label: "Basa Jawa (Javanese)" },
  { value: "Swahili", label: "Kiswahili (Swahili)" },
  { value: "Amharic", label: "አማርኛ (Amharic)" },
  { value: "Somali", label: "Soomaali (Somali)" },
  { value: "Hausa", label: "Hausa" },
  { value: "Yoruba", label: "Yorùbá (Yoruba)" },
  { value: "Igbo", label: "Igbo" },
  { value: "Zulu", label: "isiZulu (Zulu)" },
  { value: "Xhosa", label: "isiXhosa (Xhosa)" },
  { value: "Shona", label: "chiShona (Shona)" },
  { value: "Kinyarwanda", label: "Ikinyarwanda" },
  { value: "Maori", label: "Māori" },
  { value: "Samoan", label: "Gagana Samoa (Samoan)" },
  { value: "Esperanto", label: "Esperanto" },
  { value: "Latin", label: "Latina (Latin)" },
  { value: "Luxembourgish", label: "Lëtzebuergesch" },
  { value: "Catalan", label: "Català (Catalan)" },
  { value: "Basque", label: "Euskara (Basque)" },
  { value: "Galician", label: "Galego (Galician)" },
  { value: "Yiddish", label: "ייִדיש (Yiddish)" },
  { value: "Tibetan", label: "བོད་སྐད (Tibetan)" },
  { value: "Uyghur", label: "ئۇيغۇرچە (Uyghur)" },
  { value: "Tajik", label: "Тоҷикӣ (Tajik)" },
  { value: "Dari", label: "دری (Dari)" },
  { value: "Bhojpuri", label: "भोजपुरी (Bhojpuri)" },
  { value: "Chhattisgarhi", label: "छत्तीसगढ़ी (Chhattisgarhi)" },
  { value: "Rajasthani", label: "राजस्थानी (Rajasthani)" },
  { value: "Haryanvi", label: "हरियाणवी (Haryanvi)" },
  { value: "Tulu", label: "ತುಳು (Tulu)" },
  { value: "Meitei", label: "মেইতেই (Meitei)" },
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
  const [languageSearch, setLanguageSearch] = useState("");
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const settings = useUIStore((state) => state.settings);
  const updateSettings = useUIStore((state) => state.updateSettings);
  const appearance = useUIStore((state) => state.appearance);
  const setAppearance = useUIStore((state) => state.setAppearance);
  const hydrateAppearance = useUIStore((state) => state.hydrateAppearance);
  const [appearanceReady, setAppearanceReady] = useState(false);
  const filteredLanguages = useMemo(() => {
    const query = languageSearch.trim().toLocaleLowerCase();
    return languages.filter((item) => !query || item.value.toLocaleLowerCase().includes(query) || item.label.toLocaleLowerCase().includes(query)).slice(0, 100);
  }, [languageSearch]);

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

  const openSection = (id: string) => {
    setActiveSection(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const returnToSections = () => {
    setActiveSection(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className={`account-settings-page ${appearance === "dark" ? "theme-dark" : ""}`} style={appearanceReady ? undefined : { opacity: 0 }}>
      <header className="account-settings-top">
        {activeSection ? <button type="button" className="account-round-action" onClick={returnToSections} aria-label="Back to settings sections"><ArrowLeft size={23} /></button> : <Link href="/chat" className="account-round-action" aria-label="Back to chat"><ArrowLeft size={23} /></Link>}
        <div className="account-hero">
          <div className="account-avatar-edit">
            {user?.photoURL ? <Image src={user.photoURL} alt="" width={48} height={48} unoptimized referrerPolicy="no-referrer" /> : <span>{initials(user)}</span>}
          </div>
          <strong>{authLoading ? "Loading…" : user?.displayName || user?.email?.split("@")[0] || "Guest"}</strong>
        </div>
        <button type="button" className="account-round-action account-info-action" onClick={() => openSection("account-details")} aria-label="Account information">i</button>
      </header>

      <div className="account-settings-content">
        {activeSection === null && <section className="account-settings-group">
          <button type="button" className="account-setting-row" onClick={() => openSection("account-details")}><UserRound /><span><strong>Account</strong><small>{authLoading ? "Checking account…" : user?.email || "Guest session — sign in to connect your account"}</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("personalization")}><Sparkles /><span><strong>Personalization</strong><small>Base style and tone, custom instructions</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("language")}><Globe2 /><span><strong>Language</strong><small>{language}</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("appearance")}><Palette /><span><strong>Appearance</strong><small>{appearance === "dark" ? "Dark" : "Light"} theme</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("safety")}><ShieldCheck /><span><strong>Safety</strong><small>Responsible use and AI safety</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("privacy-center")}><LockKeyhole /><span><strong>Privacy center</strong><small>How your data is handled</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("help-center")}><HelpCircle /><span><strong>Help center</strong><small>Support and common questions</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("terms")}><FileText /><span><strong>Terms of service</strong><small>Terms for using TIWAT</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("privacy-policy")}><ShieldCheck /><span><strong>Privacy policy</strong><small>Privacy and data practices</small></span><ChevronRight /></button>
          <button type="button" className="account-setting-row" onClick={() => openSection("license")}><FileText /><span><strong>License</strong><small>MIT License</small></span><ChevronRight /></button>
        </section>}

        <section id="account-details" className="account-detail-section" style={{ display: activeSection === "account-details" ? undefined : "none" }}>
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

        <section id="personalization" className="account-detail-section" style={{ display: activeSection === "personalization" ? undefined : "none" }}>
          <h2>Personalization</h2>
          <div className="account-detail-card">
            <strong>Base style and tone</strong>
            <div className="account-style-grid">{styles.map((option) => { const Icon = option.icon; return <button type="button" key={option.id} className={`account-style-option ${settings.chatStyle === option.id ? "selected" : ""}`} onClick={() => updateSettings({ chatStyle: option.id })}><Icon size={17} /><span>{option.title}</span>{settings.chatStyle === option.id && <Check size={15} />}</button>; })}</div>
            <label className="account-field-label" htmlFor="account-custom-instructions">Custom instructions</label>
            <textarea id="account-custom-instructions" className="settings-textarea" maxLength={2000} rows={4} value={settings.customSystemPrompt} onChange={(e) => updateSettings({ customSystemPrompt: e.target.value })} placeholder="Tell TIWAT how you want replies written." />
            <button type="button" className="account-primary-button" onClick={savePreferences}>{saved ? <><Check size={15} /> Saved</> : "Save preferences"}</button>
          </div>
        </section>

        <section id="language" className="account-detail-section" style={{ display: activeSection === "language" ? undefined : "none" }}>
          <h2>Language</h2>
          <div className="account-detail-card">
            <strong>Response language preference</strong>
            <div className="language-picker">
              <label className="account-field-label" htmlFor="language-search">Search and select a language</label>
              <div className="language-picker-control">
                <Globe2 size={18} aria-hidden="true" />
                <input id="language-search" type="search" value={languageSearch} onChange={(event) => { setLanguageSearch(event.target.value); setLanguagePickerOpen(true); }} onFocus={() => setLanguagePickerOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setLanguagePickerOpen(false); if (event.key === "Enter" && filteredLanguages.length > 0) { event.preventDefault(); setLanguage(filteredLanguages[0].value); setLanguageSearch(""); setLanguagePickerOpen(false); } }} placeholder="Type a language name…" autoComplete="off" aria-expanded={languagePickerOpen} aria-controls="language-options" />
                <button type="button" className="language-picker-toggle" onClick={() => setLanguagePickerOpen((open) => !open)} aria-label={languagePickerOpen ? "Close language list" : "Open language list"}><ChevronRight size={17} className={languagePickerOpen ? "language-picker-chevron open" : "language-picker-chevron"} /></button>
              </div>
              <div className="language-picker-current">Selected: <strong>{languages.find((item) => item.value === language)?.label || language}</strong></div>
              {languagePickerOpen && <div id="language-options" className="language-picker-options" role="listbox" aria-label="Available languages">
                {filteredLanguages.length ? filteredLanguages.map((item) => <button type="button" role="option" aria-selected={language === item.value} key={item.value} className={"language-picker-option " + (language === item.value ? "selected" : "")} onClick={() => { setLanguage(item.value); setLanguageSearch(""); setLanguagePickerOpen(false); }}><span>{item.label}</span>{language === item.value && <Check size={16} />}</button>) : <p className="language-picker-empty">No matching language. Try another spelling.</p>}
              </div>}
            </div>
            <p className="account-setting-note">Everyday replies use your selected language. Complex, difficult, and technical topics stay in English.</p>
            <button type="button" className="account-primary-button" onClick={savePreferences}>{saved ? "Saved" : "Save language"}</button>
          </div>
        </section>

        <section id="appearance" className="account-detail-section" style={{ display: activeSection === "appearance" ? undefined : "none" }}>
          <h2>Appearance</h2>
          <div className="account-detail-card">
            <div className="account-style-grid">
              <button className={`account-style-option ${appearance === "light" ? "selected" : ""}`} type="button" onClick={() => setAppearance("light")}><Sun size={17} /><span>Light</span>{appearance === "light" && <Check size={15} />}</button>
              <button className={`account-style-option ${appearance === "dark" ? "selected" : ""}`} type="button" onClick={() => setAppearance("dark")}><Moon size={17} /><span>Dark</span>{appearance === "dark" && <Check size={15} />}</button>
            </div>
          </div>
        </section>

        <section id="safety" className="account-detail-section" style={{ display: activeSection === "safety" ? undefined : "none" }}>
          <h2>Safety</h2>
          <div className="account-detail-card"><div className="account-info-row"><ShieldCheck /><div><strong>Use AI thoughtfully</strong><p>AI responses can be inaccurate. Verify important information and do not enter passwords, API keys, or other sensitive secrets into chat.</p></div></div><div className="account-info-row"><LockKeyhole /><div><strong>Account security</strong><p>Sign-in is managed through Firebase Authentication. Keep access to your Google or email account secure.</p></div></div></div>
        </section>

        <section id="privacy-center" className="account-detail-section" style={{ display: activeSection === "privacy-center" ? undefined : "none" }}>
          <h2>Privacy center</h2>
          <div className="account-detail-card"><div className="account-info-row"><LockKeyhole /><div><strong>Conversation history</strong><p>Chat history is stored in this browser and is not currently synced across devices.</p></div></div><div className="account-info-row"><ShieldCheck /><div><strong>AI requests</strong><p>Messages are sent to the configured server-side AI provider to generate replies.</p></div></div><Link href="/privacy" className="account-inline-link">Open privacy policy <ChevronRight size={15} /></Link></div>
        </section>

        <section id="help-center" className="account-detail-section" style={{ display: activeSection === "help-center" ? undefined : "none" }}>
          <h2>Help center</h2>
          <div className="account-detail-card"><div className="account-info-row"><HelpCircle /><div><strong>Need help?</strong><p>For sign-in or app issues, check the project documentation and repository issue tracker.</p></div></div><a className="account-inline-link" href="https://github.com/shivatmprakash9009-eng/axiom-groq-chat/issues" target="_blank" rel="noreferrer">Open support issues <ChevronRight size={15} /></a></div>
        </section>

        <section id="terms" className="account-detail-section" style={{ display: activeSection === "terms" ? undefined : "none" }}><h2>Terms of service</h2><div className="account-detail-card"><p>Use TIWAT lawfully and responsibly. AI output may be incorrect; verify important decisions independently.</p><Link href="/terms" className="account-inline-link">Read terms of service <ChevronRight size={15} /></Link></div></section>
        <section id="privacy-policy" className="account-detail-section" style={{ display: activeSection === "privacy-policy" ? undefined : "none" }}><h2>Privacy policy</h2><div className="account-detail-card"><p>Review how account authentication, chat requests, and local conversation history work.</p><Link href="/privacy" className="account-inline-link">Read privacy policy <ChevronRight size={15} /></Link></div></section>

        <section id="license" className="account-detail-section" style={{ display: activeSection === "license" ? undefined : "none" }}><h2>License</h2><div className="account-detail-card"><strong>MIT License</strong><p>This project is available under the MIT License. See the complete license and copyright notice in the repository.</p><a className="account-inline-link" href="https://github.com/shivatmprakash9009-eng/axiom-groq-chat/blob/main/LICENSE" target="_blank" rel="noreferrer">View full license <ChevronRight size={15} /></a></div></section>

        <footer className="account-settings-footer"><span>TIWAT · Account settings</span><Link href="/chat">← Back to chat</Link></footer>
      </div>
    </main>
  );
}

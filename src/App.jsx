import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  Activity, ArrowDown, ArrowUp, Check, ChevronDown, Copy, FileText, Menu,
  MessageSquare, Moon, Paperclip, Plus, Search, Send, Settings2, Sparkles,
  Square, Sun, Trash2, X, Zap, PanelLeftClose
} from 'lucide-react';

gsap.registerPlugin(useGSAP);

const MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', description: 'Advanced reasoning' },
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', description: 'Fast and capable' }
];
const STORAGE_KEY = 'axiom.groq-chat.v1';
const STARTERS = [
  { icon: '✳', title: 'Think something through', text: 'Help me explore an idea and find the strongest next step.' },
  { icon: '⌘', title: 'Build with AI', text: 'Help me design a practical AI-powered product from scratch.' },
  { icon: '↗', title: 'Write with clarity', text: 'Help me write something clear, engaging, and well structured.' },
  { icon: '⌕', title: 'Learn a new concept', text: 'Explain a complex concept with a simple example and a deeper view.' }
];
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const timestamp = () => Date.now();

function readChats() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function Markdown({ content }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{content || ''}</ReactMarkdown>;
}

function CodeCopy({ children }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(children ?? ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch { setCopied(false); }
  };
  return <button className="code-copy" onClick={copy} aria-label="Copy code"><Copy size={13} />{copied ? 'Copied' : 'Copy'}</button>;
}

export default function App() {
  const reducedMotion = useReducedMotion();
  const shellRef = useRef(null);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const [chats, setChats] = useState(readChats);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [modelOpen, setModelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState({ loaded: false, configured: false });
  const [attachment, setAttachment] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeChat = chats.find(chat => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];
  const landing = messages.length === 0;
  const generating = Boolean(generatingId && generatingId === activeId);
  const selectedModel = MODELS.find(item => item.id === model) || MODELS[0];
  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...chats].filter(chat => !q || chat.title.toLowerCase().includes(q) || chat.messages.some(m => m.content.toLowerCase().includes(q)))
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  }, [chats, search]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 80))); } catch { /* Storage can be unavailable. */ }
  }, [chats]);

  useEffect(() => {
    let alive = true;
    fetch('/api/health').then(response => response.json()).then(data => {
      if (alive) setHealth({ ...data, loaded: true });
    }).catch(() => {
      if (alive) setHealth({ loaded: true, configured: false, offline: true, provider: 'Groq' });
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (landing && !reducedMotion) {
      gsap.fromTo('.hero-animate', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .65, stagger: .09, ease: 'power3.out', clearProps: 'all' });
    }
  }, [landing, activeId, reducedMotion]);

  useEffect(() => {
    if (!landing) messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'end' });
  }, [messages, landing, reducedMotion]);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 2300);
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGeneratingId(null);
    const id = uid();
    setChats(previous => [{ id, title: 'New conversation', createdAt: timestamp(), updatedAt: timestamp(), messages: [] }, ...previous]);
    setActiveId(id);
    setDraft('');
    setAttachment(null);
    setMobileSidebar(false);
    setModelOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, []);

  const selectChat = useCallback((id) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGeneratingId(null);
    setActiveId(id);
    setMobileSidebar(false);
    setModelOpen(false);
  }, []);

  const deleteChat = (id) => {
    setChats(previous => previous.filter(chat => chat.id !== id));
    if (activeId === id) setActiveId(null);
    notify('Conversation removed');
  };
  const sendMessage = useCallback(async (override) => {
    const text = (override ?? draft).trim();
    if ((!text && !attachment) || generatingId) return;
    const id = activeId || uid();
    const userText = text || `Please analyze the attached text file: ${attachment?.name || 'file'}`;
    const userMessage = {
      id: uid(), role: 'user', content: userText, createdAt: timestamp(),
      fileName: attachment?.name || null, fileContent: attachment?.content || null
    };
    const assistantMessage = { id: uid(), role: 'assistant', content: '', createdAt: timestamp() };
    const previousChat = chats.find(chat => chat.id === id);
    const priorMessages = previousChat?.messages || [];
    setChats(previous => {
      const current = previous.find(chat => chat.id === id);
      const updated = current
        ? previous.map(chat => chat.id !== id ? chat : {
            ...chat,
            title: chat.messages.length ? chat.title : userText.slice(0, 48) + (userText.length > 48 ? '…' : ''),
            updatedAt: timestamp(), messages: [...chat.messages, userMessage, assistantMessage]
          })
        : [{ id, title: userText.slice(0, 48) + (userText.length > 48 ? '…' : ''), createdAt: timestamp(), updatedAt: timestamp(), messages: [userMessage, assistantMessage] }, ...previous];
      return updated;
    });
    setActiveId(id);
    setDraft('');
    setAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setGeneratingId(id);
    const controller = new AbortController();
    abortRef.current = controller;
    const history = [...priorMessages, userMessage].slice(-30).map(message => ({
      role: message.role,
      content: message.fileContent
        ? `${message.content}\n\n[Attached text file: ${message.fileName}]\n--- FILE CONTENT START ---\n${message.fileContent}\n--- FILE CONTENT END ---`
        : message.content
    }));
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: history }), signal: controller.signal
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      if (!response.body) throw new Error('This browser does not support response streaming.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      const consumeLine = (line) => {
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') return;
        try {
          const payload = JSON.parse(data);
          if (payload.error) throw new Error(payload.error);
          if (typeof payload.delta === 'string') fullText += payload.delta;
        } catch (error) {
          if (error instanceof SyntaxError) return;
          throw error;
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) consumeLine(line.trim());
        setChats(previous => previous.map(chat => chat.id !== id ? chat : {
          ...chat, updatedAt: timestamp(), messages: chat.messages.map(message => message.id === assistantMessage.id ? { ...message, content: fullText } : message)
        }));
      }
      if (buffer.trim()) consumeLine(buffer.trim());
      setChats(previous => previous.map(chat => chat.id !== id ? chat : {
        ...chat, updatedAt: timestamp(), messages: chat.messages.map(message => message.id === assistantMessage.id ? { ...message, content: fullText || 'I did not receive a response. Please try again.' } : message)
      }));
    } catch (error) {
      if (error?.name !== 'AbortError') {
        const message = `**Could not complete the response**\n\n${error?.message || 'An unexpected error occurred.'}`;
        setChats(previous => previous.map(chat => chat.id !== id ? chat : {
          ...chat, messages: chat.messages.map(item => item.id === assistantMessage.id ? { ...item, content: message } : item)
        }));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setGeneratingId(current => current === id ? null : current);
    }
  }, [activeId, attachment, chats, draft, generatingId, model]);

  const stopGeneration = () => { abortRef.current?.abort(); abortRef.current = null; setGeneratingId(null); notify('Generation stopped'); };

  const onComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); sendMessage();
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const supported = /\.(txt|md|csv|json|html|log)$/i.test(file.name);
    if (!supported) { notify('Choose a TXT, MD, CSV, JSON, HTML, or LOG file'); return; }
    if (file.size > 180 * 1024) { notify('Text attachments must be under 180 KB'); return; }
    try { setAttachment({ name: file.name, content: await file.text() }); }
    catch { notify('Could not read this file'); }
  };

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); notify('Copied to clipboard'); }
    catch { notify('Clipboard access is unavailable'); }
  };

  const exportChat = () => {
    if (!activeChat) return;
    const content = `# ${activeChat.title}\n\n` + activeChat.messages.map(message => `## ${message.role === 'user' ? 'You' : 'Axiom'}\n\n${message.content}`).join('\n\n---\n\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    link.download = `${activeChat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'axiom-chat'}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify('Conversation exported');
  };

  return <div ref={shellRef} className={`app-shell ${dark ? 'theme-dark' : 'theme-light'}`}>
    <AnimatePresence>{mobileSidebar && <motion.button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileSidebar(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}</AnimatePresence>
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'} ${mobileSidebar ? 'sidebar-mobile-visible' : ''}`}>
      <div className="brand-row"><div className="brand-mark"><Sparkles size={17} strokeWidth={2.4}/></div>{sidebarOpen && <><span className="brand-name">axiom<span>.</span></span><button className="quiet-icon sidebar-collapse" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><PanelLeftClose size={17}/></button></>}</div>
      {!sidebarOpen && <button className="quiet-icon sidebar-expand" onClick={() => setSidebarOpen(true)} aria-label="Expand sidebar"><Menu size={18}/></button>}
      <button className="new-chat-button" onClick={newChat}><Plus size={17}/>{sidebarOpen && <span>New conversation</span>}<kbd>⌘ K</kbd></button>
      {sidebarOpen && <div className="sidebar-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search chats" aria-label="Search conversations"/><kbd>⌘F</kbd></div>}
      {sidebarOpen && <div className="history"><div className="section-label">YOUR HISTORY</div>{filteredChats.length ? filteredChats.map(chat => <div key={chat.id} className={`history-item ${activeId === chat.id ? 'history-active' : ''}`}><button className="history-select" onClick={() => selectChat(chat.id)} title={chat.title}><MessageSquare size={15}/><span>{chat.title}</span></button><button className="history-delete" onClick={() => deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}><Trash2 size={13}/></button></div>) : <div className="history-empty">{search ? 'No matching conversations' : 'Your conversations will appear here.'}</div>}</div>}
      <div className="sidebar-bottom">{sidebarOpen && <div className={`api-status ${health.configured ? 'api-ready' : 'api-pending'}`}><span className="status-dot"/><span>{health.configured ? 'Groq connected' : health.offline ? 'API unavailable' : 'API setup required'}</span><button onClick={() => setSettingsOpen(v => !v)} aria-label="Open settings"><Settings2 size={14}/></button></div>}<div className="profile-row"><div className="profile-avatar">A</div>{sidebarOpen && <div className="profile-copy"><strong>Personal workspace</strong><span>Private on this device</span></div>}<button className="quiet-icon profile-settings" onClick={() => setSettingsOpen(v => !v)} aria-label="Settings"><Settings2 size={17}/></button></div></div>
    </aside>
    <main className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="quiet-icon mobile-menu" onClick={() => setMobileSidebar(v => !v)} aria-label="Open navigation"><Menu size={19}/></button>{!sidebarOpen && <button className="quiet-icon desktop-menu" onClick={() => setSidebarOpen(true)} aria-label="Expand navigation"><Menu size={18}/></button>}<div className="workspace-label"><span>Workspace</span><span className="crumb-separator">/</span><strong>{activeChat?.title || 'New conversation'}</strong></div></div><div className="topbar-right"><div className="model-picker"><button className="model-trigger" onClick={() => setModelOpen(v => !v)} aria-expanded={modelOpen}><span className="model-orb"><Zap size={14}/></span><span>{selectedModel.name}</span><ChevronDown size={14}/></button><AnimatePresence>{modelOpen && <motion.div className="model-menu" initial={{ opacity: 0, y: 7, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5 }}><div className="model-menu-label">SELECT A MODEL</div>{MODELS.map(item => <button key={item.id} className={`model-option ${model === item.id ? 'model-option-active' : ''}`} onClick={() => { setModel(item.id); setModelOpen(false); }}><span className="model-option-icon"><Sparkles size={15}/></span><span className="model-option-text"><strong>{item.name}</strong><small>{item.description}</small></span>{model === item.id && <Check size={16}/>}</button>)}</motion.div>}</AnimatePresence></div><button className="quiet-icon theme-toggle" onClick={() => setDark(v => !v)} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button>{activeChat && messages.length > 0 && <button className="export-button" onClick={exportChat}><ArrowDown size={14}/> Export</button>}</div></header>

      <section className={`conversation-area ${landing ? 'landing-area' : 'messages-area'}`}>
        {landing ? <div className="landing-content">
          <motion.div className="hero-badge hero-animate" initial={false}><span className="badge-pulse"/><span>AN INTELLIGENT WORKSPACE</span></motion.div>
          <h1 className="hero-heading"><span className="hero-animate">Ideas start here.</span><span className="hero-gradient hero-animate">Clarity follows.</span></h1>
          <p className="hero-subtitle hero-animate">A thoughtful space to think bigger, solve problems, and turn your next idea into something real.</p>
          <div className="starter-grid">{STARTERS.map((item, index) => <motion.button key={item.title} className="starter-card hero-animate" onClick={() => { setDraft(item.text); textareaRef.current?.focus(); }} initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 + index * .07, duration: .42 }} whileHover={reducedMotion ? undefined : { y: -3 }}><span className={`starter-icon starter-icon-${index}`}>{item.icon}</span><span className="starter-title">{item.title}</span><span className="starter-description">{item.text}</span><span className="starter-arrow">↗</span></motion.button>)}</div>
          <div className="landing-note hero-animate"><Sparkles size={14}/><span>Ask anything. Refine as you go.</span></div>
        </div> : <div className="messages-wrap">{messages.map((message, index) => <motion.article key={message.id} className={`message-row ${message.role === 'user' ? 'user-message' : 'assistant-message'}`} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .23 }}><div className={`message-avatar ${message.role === 'assistant' ? 'assistant-avatar' : 'user-avatar'}`}>{message.role === 'assistant' ? <Sparkles size={15}/> : 'Y'}</div><div className="message-main"><div className="message-meta"><strong>{message.role === 'assistant' ? 'Axiom' : 'You'}</strong><span>{message.role === 'assistant' ? 'AI assistant' : message.fileName || 'Message'}</span></div>{message.role === 'user' ? <div className="user-content">{message.fileName && <div className="message-file"><FileText size={14}/>{message.fileName}</div>}{message.content}</div> : <div className="assistant-content">{message.content ? <Markdown content={message.content}/> : <div className="thinking-state"><span/><span/><span/> Thinking through your question…</div>}</div>}{message.role === 'assistant' && message.content && !(generating && index === messages.length - 1) && <div className="message-actions"><button onClick={() => copyText(message.content)}><Copy size={13}/> Copy response</button></div>}</div></motion.article>)}<div ref={messagesEndRef}/></div>}
      </section>

      <footer className="composer-dock"><div className={`composer ${attachment ? 'composer-has-attachment' : ''}`}><AnimatePresence>{attachment && <motion.div className="attachment-chip" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><FileText size={15}/><span>{attachment.name}</span><button onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={14}/></button></motion.div>}</AnimatePresence><textarea ref={textareaRef} value={draft} rows={1} placeholder="Message Axiom…" aria-label="Message Axiom" onChange={event => { setDraft(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 190)}px`; }} onKeyDown={onComposerKeyDown}/><div className="composer-bottom"><div className="composer-tools"><input ref={fileRef} type="file" hidden accept=".txt,.md,.csv,.json,.html,.log,text/plain,text/markdown,text/csv,application/json" onChange={handleFile}/><button className="composer-tool" onClick={() => fileRef.current?.click()} aria-label="Attach text file"><Paperclip size={17}/><span>Attach</span></button><span className="tool-divider"/><span className="composer-mode"><span className="status-dot"/> Groq-powered AI</span></div><div className="composer-actions">{generating ? <button className="send-button stop-button" onClick={stopGeneration} aria-label="Stop response"><Square size={14} fill="currentColor"/></button> : <button className="send-button" onClick={() => sendMessage()} disabled={!draft.trim() && !attachment} aria-label="Send message"><Send size={16}/></button>}</div></div></div><p className="composer-disclaimer">Axiom can make mistakes. Verify important information.</p></footer>
    </main>

    <AnimatePresence>{settingsOpen && <><motion.button className="modal-scrim" aria-label="Close settings" onClick={() => setSettingsOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/><motion.section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }}><header><div><span className="settings-eyebrow">WORKSPACE</span><h2 id="settings-title">Settings</h2></div><button className="quiet-icon" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18}/></button></header><section className="settings-block"><div className="settings-block-title"><Activity size={17}/><div><strong>Groq connection</strong><span>Server-side API configuration</span></div><span className={`settings-status ${health.configured ? 'connected' : ''}`}>{health.configured ? 'Connected' : 'Not set up'}</span></div><p>{health.configured ? 'The server reports that the Groq API key is configured.' : 'Add GROQ_API_KEY in your hosting provider’s environment variables, then redeploy. Keep the key on the server only.'}</p><div className="settings-row"><span>Provider</span><strong>Groq Cloud</strong></div><div className="settings-row"><span>Model</span><strong>{selectedModel.name}</strong></div><button className="settings-test" onClick={() => fetch('/api/health').then(response => response.json()).then(data => { setHealth({ ...data, loaded: true }); notify(data.configured ? 'Groq is configured' : 'GROQ_API_KEY is not configured'); }).catch(() => notify('API server is unreachable'))}>Test connection <ArrowUp size={14}/></button></section><section className="settings-block"><div className="settings-block-title"><span className="theme-icon"><Sun size={16}/></span><div><strong>Appearance</strong><span>Choose your workspace theme</span></div></div><div className="theme-choices"><button className={!dark ? 'selected' : ''} onClick={() => setDark(false)}><Sun size={15}/> Light {!dark && <Check size={14}/>}</button><button className={dark ? 'selected' : ''} onClick={() => setDark(true)}><Moon size={15}/> Dark {dark && <Check size={14}/>}</button></div></section><p className="settings-footnote"><Check size={14}/> Your API key is handled by the backend and never sent to the browser.</p></motion.section></>}</AnimatePresence>
    <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 7 }}><Check size={15}/>{toast}</motion.div>}</AnimatePresence>
  </div>;
}

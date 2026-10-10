import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  ArrowUp, Check, ChevronDown, CircleStop, Copy, FileText, Menu,
  MessageSquare, Moon, Paperclip, PanelLeftClose, Plus, Search,
  Sparkles, Sun, Trash2, X, Zap
} from 'lucide-react';

const MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', detail: 'Best for complex tasks' },
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', detail: 'Faster responses' }
];
const CHAT_STORAGE = 'axiom.groq-chat.v2';
const ACTIVE_STORAGE = 'axiom.groq-chat.active.v2';
const THEME_STORAGE = 'axiom.groq-chat.theme.v1';
const MAX_CHATS = 100;
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now = () => Date.now();

function loadChats() {
  try {
    const data = JSON.parse(localStorage.getItem(CHAT_STORAGE) || '[]');
    return Array.isArray(data) ? data.filter(chat => chat && typeof chat.id === 'string' && Array.isArray(chat.messages)) : [];
  } catch {
    return [];
  }
}

function shortTitle(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 46 ? `${clean.slice(0, 46).trimEnd()}…` : clean || 'New chat';
}

function historyGroup(timestamp) {
  const date = new Date(timestamp || now());
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startToday - startDate) / 86400000);
  if (dayDifference <= 0) return 'Today';
  if (dayDifference === 1) return 'Yesterday';
  if (dayDifference < 7) return 'Previous 7 days';
  if (dayDifference < 30) return 'Previous 30 days';
  return 'Older';
}

function Markdown({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre({ children, ...props }) {
          return (
            <div className="code-block">
              <div className="code-block-top"><span>Code</span><CodeCopy text={extractCode(children)} /></div>
              <pre {...props}>{children}</pre>
            </div>
          );
        },
        a({ href, children, ...props }) {
          return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
        }
      }}
    >
      {content || ''}
    </ReactMarkdown>
  );
}

function extractCode(children) {
  const walk = (node) => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(walk).join('');
    if (node && typeof node === 'object' && 'props' in node) return walk(node.props.children);
    return '';
  };
  return walk(children);
}

function CodeCopy({ text }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return <button className="code-copy" onClick={onCopy} type="button"><Copy size={13} />{copied ? 'Copied' : 'Copy code'}</button>;
}

function ChatMessage({ message, onCopy, isLastAssistant, isGenerating }) {
  const isUser = message.role === 'user';
  return (
    <article className={`message-row ${isUser ? 'message-user' : 'message-assistant'}`}>
      {!isUser && <div className="assistant-mark" aria-hidden="true"><Sparkles size={16} /></div>}
      <div className="message-content-wrap">
        {!isUser && <div className="message-author">Axiom</div>}
        {isUser ? (
          <div className="user-bubble">
            {message.fileName && <div className="message-file"><FileText size={15} /><span>{message.fileName}</span></div>}
            {message.content}
          </div>
        ) : (
          <div className="markdown-body">
            {message.content ? <Markdown content={message.content} /> : (
              <div className="thinking-dots" aria-label="Generating response"><span /><span /><span /></div>
            )}
          </div>
        )}
        {!isUser && message.content && !(isLastAssistant && isGenerating) && (
          <div className="message-actions">
            <button type="button" onClick={() => onCopy(message.content)} aria-label="Copy response"><Copy size={14} /><span>Copy</span></button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_STORAGE); } catch { return null; }
  });
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_STORAGE) === 'dark'; } catch { return false; }
  });
  const [attachment, setAttachment] = useState(null);
  const [health, setHealth] = useState({ loaded: false, configured: false });
  const [generatingId, setGeneratingId] = useState(null);
  const [toast, setToast] = useState('');
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const modelMenuRef = useRef(null);

  const activeChat = chats.find(chat => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];
  const generating = Boolean(generatingId);
  const selectedModel = MODELS.find(item => item.id === model) || MODELS[0];

  const groupedChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = [...chats]
      .filter(chat => !query || chat.title.toLowerCase().includes(query) || chat.messages.some(message => message.content.toLowerCase().includes(query)))
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    const groups = [];
    for (const chat of filtered) {
      const label = historyGroup(chat.updatedAt || chat.createdAt);
      let group = groups.find(item => item.label === label);
      if (!group) {
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(chat);
    }
    return groups;
  }, [chats, search]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE, JSON.stringify([...chats]
        .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
        .slice(0, MAX_CHATS)));
    } catch { /* The chat still works when browser storage is disabled. */ }
  }, [chats]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_STORAGE, activeId);
      else localStorage.removeItem(ACTIVE_STORAGE);
    } catch { /* Ignore unavailable storage. */ }
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE, dark ? 'dark' : 'light');
    } catch { /* Ignore unavailable storage. */ }
  }, [dark]);

  useEffect(() => {
    let alive = true;
    fetch('/api/health')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('API health check failed')))
      .then(data => { if (alive) setHealth({ ...data, loaded: true }); })
      .catch(() => { if (alive) setHealth({ loaded: true, configured: false, offline: true }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (messages.length) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, generatingId]);

  useEffect(() => {
    if (!modelMenuOpen) return undefined;
    const handlePointer = event => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) setModelMenuOpen(false);
    };
    const handleKey = event => { if (event.key === 'Escape') setModelMenuOpen(false); };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [modelMenuOpen]);

  useEffect(() => {
    const handleKeys = event => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        newChat();
      }
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        setMobileNavOpen(true);
        window.setTimeout(() => document.querySelector('.sidebar-search-input')?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  });

  const notify = useCallback(message => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 2000);
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGeneratingId(null);
    setActiveId(null);
    setDraft('');
    setAttachment(null);
    setModelMenuOpen(false);
    setMobileNavOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    window.setTimeout(() => textareaRef.current?.focus(), 40);
  }, []);

  const openChat = useCallback(id => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGeneratingId(null);
    setActiveId(id);
    setMobileNavOpen(false);
    setModelMenuOpen(false);
  }, []);

  const removeChat = useCallback((event, id) => {
    event.stopPropagation();
    setChats(previous => previous.filter(chat => chat.id !== id));
    if (activeId === id) setActiveId(null);
    notify('Chat deleted');
  }, [activeId, notify]);

  const copyToClipboard = useCallback(async (text, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      notify(label);
    } catch {
      notify('Clipboard unavailable in this browser');
    }
  }, [notify]);

  const sendMessage = useCallback(async override => {
    const text = String(override ?? draft).trim();
    if ((!text && !attachment) || abortRef.current) return;
    const chatId = activeId || uid();
    const createdAt = now();
    const userMessage = {
      id: uid(),
      role: 'user',
      content: text || `Please help me with the attached text file: ${attachment?.name || 'attachment'}`,
      createdAt,
      fileName: attachment?.name || null,
      fileContent: attachment?.content || null
    };
    const assistantMessage = { id: uid(), role: 'assistant', content: '', createdAt: now() };
    const previousChat = chats.find(chat => chat.id === chatId);
    const previousMessages = previousChat?.messages || [];
    const title = previousChat?.title && previousMessages.length
      ? previousChat.title
      : shortTitle(userMessage.content);

    setChats(previous => {
      const existing = previous.find(chat => chat.id === chatId);
      if (existing) {
        return previous.map(chat => chat.id === chatId
          ? { ...chat, title, updatedAt: now(), messages: [...chat.messages, userMessage, assistantMessage] }
          : chat);
      }
      return [{ id: chatId, title, createdAt, updatedAt: now(), messages: [userMessage, assistantMessage] }, ...previous];
    });
    setActiveId(chatId);
    setDraft('');
    setAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const controller = new AbortController();
    abortRef.current = controller;
    setGeneratingId(chatId);
    const history = [...previousMessages, userMessage].slice(-32).map(message => ({
      role: message.role,
      content: message.fileContent
        ? `${message.content}\n\n[Attached text file: ${message.fileName}]\n--- FILE CONTENT START ---\n${message.fileContent}\n--- FILE CONTENT END ---`
        : message.content
    }));

    const setAssistantContent = (content) => {
      setChats(previous => previous.map(chat => chat.id !== chatId ? chat : ({
        ...chat,
        updatedAt: now(),
        messages: chat.messages.map(message => message.id === assistantMessage.id ? { ...message, content } : message)
      })));
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: history }),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${response.status})`);
      }
      if (!response.body) throw new Error('Streaming is not supported by this browser.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let doneSignal = false;

      const processEvent = eventText => {
        const data = eventText.split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .join('\n');
        if (!data) return;
        if (data === '[DONE]') { doneSignal = true; return; }
        let payload;
        try { payload = JSON.parse(data); } catch { return; }
        if (payload.error) throw new Error(payload.error);
        if (typeof payload.delta === 'string') fullText += payload.delta;
        if (payload.done) doneSignal = true;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        for (const eventText of events) {
          processEvent(eventText);
          setAssistantContent(fullText);
        }
      }
      if (buffer.trim()) processEvent(buffer);
      setAssistantContent(fullText || (doneSignal ? 'I did not receive any text. Please try again.' : 'The response ended early. Please try again.'));
    } catch (error) {
      if (error?.name !== 'AbortError') {
        const message = `**Could not complete the response**\n\n${error?.message || 'Something went wrong. Please try again.'}`;
        setAssistantContent(message);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setGeneratingId(current => current === chatId ? null : current);
    }
  }, [activeId, attachment, chats, draft, model]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGeneratingId(null);
    notify('Response stopped');
  }, [notify]);

  const onComposerKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(txt|md|csv|json|html|log)$/i.test(file.name)) {
      notify('Attach a TXT, MD, CSV, JSON, HTML, or LOG file');
      return;
    }
    if (file.size > 180 * 1024) {
      notify('Text files must be smaller than 180 KB');
      return;
    }
    try {
      const content = await file.text();
      setAttachment({ name: file.name, content });
    } catch {
      notify('Could not read this file');
    }
  };

  const exportChat = useCallback(() => {
    if (!activeChat) return;
    const body = `# ${activeChat.title}\n\n` + activeChat.messages
      .map(message => `## ${message.role === 'user' ? 'You' : 'Axiom'}\n\n${message.content}`)
      .join('\n\n---\n\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeChat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'axiom-chat'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Chat exported');
  }, [activeChat, notify]);

  const clearSearch = () => {
    setSearch('');
    setSearchOpen(false);
  };

  const showLanding = !activeChat || messages.length === 0;
  const lastAssistantIndex = messages.reduce((last, message, index) => message.role === 'assistant' ? index : last, -1);

  return (
    <div className={`app-shell ${dark ? 'theme-dark' : 'theme-light'}`}>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close sidebar" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${mobileNavOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-top">
          <button className="brand" type="button" onClick={startNewChat} aria-label="Axiom home">
            <span className="brand-icon"><Sparkles size={17} /></span>
            {sidebarOpen && <span className="brand-word">axiom<span>.</span></span>}
          </button>
          {sidebarOpen && <button className="icon-button sidebar-toggle" type="button" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar" title="Collapse sidebar"><PanelLeftClose size={18} /></button>}
        </div>

        {!sidebarOpen && <button className="icon-button expand-sidebar" type="button" onClick={() => setSidebarOpen(true)} aria-label="Expand sidebar"><Menu size={18} /></button>}

        <div className="sidebar-actions">
          <button className="new-chat" type="button" onClick={startNewChat} title="New chat">
            <Plus size={17} />
            {sidebarOpen && <><span>New chat</span><kbd>Ctrl Shift O</kbd></>}
          </button>
          {sidebarOpen && (
            <button className="search-chat" type="button" onClick={() => { setSearchOpen(value => !value); setSearch(''); }}>
              <Search size={16} /><span>Search chats</span><kbd>Ctrl K</kbd>
            </button>
          )}
        </div>

        {sidebarOpen && (
          <div className="history-panel">
            {searchOpen && <div className="sidebar-search-box"><Search size={15} /><input className="sidebar-search-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search your chats" autoFocus /><button className="tiny-icon" onClick={clearSearch} aria-label="Clear search"><X size={14} /></button></div>}
            <div className="history-scroll">
              {groupedChats.length ? groupedChats.map(group => (
                <section className="history-group" key={group.label}>
                  <div className="history-label">{group.label}</div>
                  {group.items.map(chat => (
                    <div key={chat.id} className={`history-item ${chat.id === activeId ? 'history-item-active' : ''}`}>
                      <button type="button" className="history-open" onClick={() => openChat(chat.id)} title={chat.title}>
                        <span>{chat.title}</span>
                      </button>
                      <button type="button" className="history-delete" onClick={event => removeChat(event, chat.id)} aria-label={`Delete ${chat.title}`} title="Delete chat"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </section>
              )) : (
                <div className="empty-history">{search ? 'No matching chats.' : 'Your recent chats will appear here.'}</div>
              )}
            </div>
          </div>
        )}

        <div className="sidebar-bottom">
          {sidebarOpen && <div className="provider-status"><span className={`status-dot ${health.configured ? 'status-online' : ''}`} /><span>{health.configured ? 'Groq ready' : health.offline ? 'API unavailable' : 'Connecting to Groq'}</span></div>}
          <div className="sidebar-footer">
            <div className="user-avatar">A</div>
            {sidebarOpen && <div className="account-copy"><strong>Axiom</strong><span>Chats saved on this device</span></div>}
            <button className="icon-button footer-theme" type="button" onClick={() => setDark(value => !value)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-start">
            <button className="icon-button mobile-menu" type="button" onClick={() => setMobileNavOpen(value => !value)} aria-label="Open navigation"><Menu size={20} /></button>
            {!sidebarOpen && <button className="icon-button desktop-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Expand sidebar"><PanelLeftClose size={18} /></button>}
            <div className="model-menu-wrap" ref={modelMenuRef}>
              <button className="model-trigger" type="button" onClick={() => setModelMenuOpen(value => !value)} aria-expanded={modelMenuOpen}>
                <span>{selectedModel.name}</span><ChevronDown size={15} />
              </button>
              {modelMenuOpen && <div className="model-dropdown">
                <div className="dropdown-heading">Choose a model</div>
                {MODELS.map(item => <button key={item.id} className={`model-choice ${model === item.id ? 'model-choice-active' : ''}`} type="button" onClick={() => { setModel(item.id); setModelMenuOpen(false); }}>
                  <span className="model-choice-icon"><Zap size={15} /></span>
                  <span className="model-choice-copy"><strong>{item.name}</strong><small>{item.detail}</small></span>
                  {model === item.id && <Check size={16} />}
                </button>)}
              </div>}
            </div>
          </div>
          <div className="topbar-end">
            {activeChat && messages.length > 0 && <button className="topbar-action" type="button" onClick={exportChat} title="Export this chat"><FileText size={15} /><span>Export</span></button>}
          </div>
        </header>

        <section className={`conversation-area ${showLanding ? 'conversation-landing' : 'conversation-messages'}`}>
          {showLanding ? (
            <div className="welcome">
              <div className="welcome-mark"><Sparkles size={20} /></div>
              <h1>What can I help with?</h1>
              <p>Ask a question, explore an idea, or get something done.</p>
              <div className="prompt-suggestions">
                <button type="button" onClick={() => setDraft('Explain a complex topic in simple terms, with a practical example.')}><MessageSquare size={15} /><span>Explain a concept</span></button>
                <button type="button" onClick={() => setDraft('Help me brainstorm practical ideas and choose the strongest one.')}><Sparkles size={15} /><span>Brainstorm ideas</span></button>
                <button type="button" onClick={() => setDraft('Help me plan the next steps for a project.')}><Plus size={15} /><span>Plan a project</span></button>
              </div>
            </div>
          ) : (
            <div className="messages-wrap">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onCopy={text => copyToClipboard(text, 'Response copied')}
                  isLastAssistant={index === lastAssistantIndex}
                  isGenerating={generating && generatingId === activeId}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        <footer className="composer-dock">
          <div className={`composer ${attachment ? 'composer-with-attachment' : ''}`}>
            {attachment && <div className="attachment-pill"><FileText size={15} /><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={14} /></button></div>}
            <textarea
              ref={textareaRef}
              value={draft}
              rows={1}
              placeholder="Message Axiom"
              aria-label="Message Axiom"
              onChange={event => {
                setDraft(event.target.value);
                event.target.style.height = 'auto';
                event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={onComposerKeyDown}
            />
            <div className="composer-toolbar">
              <div className="composer-tools">
                <input ref={fileRef} type="file" hidden accept=".txt,.md,.csv,.json,.html,.log,text/plain,text/markdown,text/csv,application/json" onChange={handleFile} />
                <button type="button" className="attach-button" onClick={() => fileRef.current?.click()} aria-label="Attach a text file" title="Attach a text file"><Plus size={19} /></button>
                <span className="composer-hint">Attach text</span>
              </div>
              <div className="composer-submit">
                {generating && generatingId === activeId
                  ? <button className="send-button stop-button" type="button" onClick={stopGeneration} aria-label="Stop generating" title="Stop generating"><CircleStop size={19} /></button>
                  : <button className="send-button" type="button" onClick={() => sendMessage()} disabled={!draft.trim() && !attachment} aria-label="Send message" title="Send message"><ArrowUp size={19} /></button>}
              </div>
            </div>
          </div>
          <div className="composer-disclaimer">Axiom can make mistakes. Check important information.</div>
        </footer>
      </main>

      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

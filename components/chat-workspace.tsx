"use client";

import { AnimatePresence, motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import gsap from "gsap";
import {
  ArrowDownToLine, ArrowUp, Check, ChevronDown, CircleStop, Code2, Copy, FileText,
  Globe2, Lightbulb, Menu, MessageCircle, Moon, MoreHorizontal, Paperclip, PanelLeftClose,
  Plus, Search, Sparkles, Sun, X, BookOpen, PenLine, Trash2, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { composerSchema, type ComposerValues, type ConversationMessage } from "@/lib/ai/schema";
import { useUIStore } from "@/stores/ui-store";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
type Attachment = { name: string; content: string; size: number };
type SendVariables = { chatId: string; placeholderId: string; requestMessages: ConversationMessage[] };
const STORAGE_KEY = "axiom.workspace.chats.v3";
const OLD_KEYS = ["axiom.groq-chat.v2", "axiom.groq-chat.v1"];
const MAX_HISTORY = 100;
const uid = () => globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2);
const suggestions: { title: string; description: string; prompt: string; icon: LucideIcon }[] = [
  { title: "Plan something ambitious", description: "Turn a big goal into clear steps", prompt: "Help me turn a big goal into a practical, step-by-step plan with milestones.", icon: Lightbulb },
  { title: "Build or debug code", description: "Work through a technical challenge", prompt: "Help me design a clean, production-ready solution to a technical problem. Ask for any missing context.", icon: Code2 },
  { title: "Write with clarity", description: "Shape an idea into compelling words", prompt: "Help me express an idea clearly and persuasively. Start by asking what the audience and goal are.", icon: PenLine },
  { title: "Learn something deeply", description: "Make a difficult concept click", prompt: "Teach me a difficult concept from first principles, with examples and a short practice exercise.", icon: BookOpen },
];

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 45 ? clean.slice(0, 44).trimEnd() + "…" : clean || "New conversation";
}

function readHistory(): Chat[] {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    let raw: string | null = current;
    if (!raw) {
      for (const key of OLD_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is Chat => Boolean(entry && typeof entry.id === "string" && Array.isArray(entry.messages)))
      .map((entry) => ({ id: entry.id, title: String(entry.title || "Conversation"), updatedAt: Number(entry.updatedAt || Date.now()), messages: entry.messages.filter((message: Message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string") }))
      .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function ChatWorkspace() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useQueryState("c", parseAsString.withOptions({ history: "replace" }));
  const [search, setSearch] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatReady, setChatReady] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const appearance = useUIStore((state) => state.appearance);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const toggleAppearance = useUIStore((state) => state.toggleAppearance);
  const form = useForm<ComposerValues>({ resolver: zodResolver(composerSchema), defaultValues: { message: "" } });
  const draft = form.watch("message");
  const activeChat = chats.find((chat) => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];

  useEffect(() => {
    setChats(readHistory());
    setHydrated(true);
    try {
      const saved = localStorage.getItem("axiom.appearance");
      if (saved === "dark" || saved === "light") useUIStore.getState().setAppearance(saved);
    } catch { /* Browser storage may be unavailable. */ }
    fetch("/api/health", { cache: "no-store" }).then((response) => response.json()).then((value: { configured?: boolean }) => setChatReady(Boolean(value.configured))).catch(() => setChatReady(false));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_HISTORY))); } catch { toast.error("Browser storage is full. Export your chats before clearing history."); }
  }, [chats, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("axiom.appearance", appearance); } catch { /* Theme still works for this session. */ }
  }, [appearance, hydrated]);

  useEffect(() => {
    if (!activeChat && titleRef.current && welcomeRef.current) {
      const context = gsap.context(() => {
        gsap.fromTo(titleRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.52, ease: "power3.out" });
      }, welcomeRef);
      return () => context.revert();
    }
    return undefined;
  }, [activeChat?.id]);

  useEffect(() => {
    if (messages.length) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId]);

  const mutation = useMutation<{ chatId: string; placeholderId: string; message: string }, Error, SendVariables>({
    mutationFn: async ({ requestMessages }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ messages: requestMessages }),
      });
      const result: { message?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !result.message) throw new Error(result.error || "Axiom couldn't complete that response.");
      return { chatId: "", placeholderId: "", message: result.message };
    },
    onSuccess: (result, variables) => {
      setChats((current) => current.map((chat) => chat.id !== variables.chatId ? chat : {
        ...chat, updatedAt: Date.now(), messages: chat.messages.map((message) => message.id === variables.placeholderId ? { ...message, content: result.message } : message),
      }).sort((a, b) => b.updatedAt - a.updatedAt));
    },
    onError: (error, variables) => {
      if (error.name === "AbortError") {
        setChats((current) => current.map((chat) => chat.id !== variables.chatId ? chat : { ...chat, messages: chat.messages.filter((message) => message.id !== variables.placeholderId) }));
        return;
      }
      setChats((current) => current.map((chat) => chat.id !== variables.chatId ? chat : {
        ...chat,
        messages: chat.messages.map((message) => message.id === variables.placeholderId ? { ...message, content: error.message || "Something went wrong. Please try again." } : message),
      }));
      toast.error("Could not get a response", { description: error.message });
    },
    onSettled: () => { abortRef.current = null; },
  });

  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    return chats.filter((chat) => !term || chat.title.toLowerCase().includes(term) || chat.messages.some((message) => message.content.toLowerCase().includes(term)));
  }, [chats, search]);

  const startNewChat = () => {
    setActiveId(null);
    setMobileSidebarOpen(false);
    form.reset({ message: "" });
    setAttachment(null);
    window.setTimeout(() => composerRef.current?.focus(), 50);
  };

  const onSend = async ({ message }: ComposerValues) => {
    if (mutation.isPending) return;
    const text = message.trim();
    if (!text && !attachment) return;
    const apiPrompt = text + (attachment ? "\n\n[Attached text file: " + attachment.name + "]\n" + attachment.content : "");
    const chatId = activeChat?.id || uid();
    const placeholderId = uid();
    const userMessage: Message = { id: uid(), role: "user", content: text + (attachment ? "\n\nAttached file: " + attachment.name : "") };
    const placeholder: Message = { id: placeholderId, role: "assistant", content: "" };
    const prior = activeChat?.messages || [];
    if (activeChat) {
      setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, updatedAt: Date.now(), messages: [...chat.messages, userMessage, placeholder] } : chat));
    } else {
      setChats((current) => [{ id: chatId, title: titleFrom(text || attachment?.name || "New conversation"), messages: [userMessage, placeholder], updatedAt: Date.now() }, ...current].slice(0, MAX_HISTORY));
      void setActiveId(chatId);
    }
    form.reset({ message: "" });
    setAttachment(null);
    setMobileSidebarOpen(false);
    mutation.mutate({
      chatId, placeholderId,
      requestMessages: [...prior, { role: "user", content: apiPrompt }].slice(-32),
    });
  };

  const handleFormSubmit = form.handleSubmit(onSend);
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleFormSubmit();
    }
  };

  const choosePrompt = (prompt: string) => {
    form.setValue("message", prompt, { shouldDirty: true, shouldValidate: true });
    window.setTimeout(() => { void handleFormSubmit(); }, 0);
  };

  const addAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 180_000) { toast.error("File is too large", { description: "Please attach a text file smaller than 180 KB." }); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = ["txt", "md", "markdown", "csv", "json", "html", "htm", "log", "xml", "yaml", "yml", "ts", "tsx", "js", "jsx", "css", "py", "sql"];
    if (!allowed.includes(extension) && !file.type.startsWith("text/")) { toast.error("Unsupported file type", { description: "Axiom currently accepts text, code, CSV, JSON, HTML and Markdown files." }); return; }
    try {
      const content = await file.text();
      setAttachment({ name: file.name, content, size: file.size });
      toast.success("File attached", { description: file.name });
    } catch { toast.error("Couldn't read that file."); }
  };

  const copyText = async (id: string, content: string) => {
    try { await navigator.clipboard.writeText(content); setCopiedId(id); toast.success("Copied to clipboard"); window.setTimeout(() => setCopiedId(null), 1500); }
    catch { toast.error("Clipboard access is unavailable in this browser."); }
  };

  const exportChat = () => {
    if (!activeChat) { toast.info("Open a conversation to export it."); return; }
    const content = "# " + activeChat.title + "\n\n" + activeChat.messages.map((message) => "## " + (message.role === "user" ? "You" : "Axiom") + "\n\n" + message.content).join("\n\n---\n\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = titleFrom(activeChat.title).replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".md"; anchor.click(); URL.revokeObjectURL(url);
    toast.success("Conversation exported");
  };

  const clearHistory = () => {
    setChats([]);
    void setActiveId(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* best effort */ }
    toast.success("Conversation history cleared");
  };

  const stopGeneration = () => { abortRef.current?.abort(); mutation.reset(); };
  const openChat = (id: string) => { void setActiveId(id); setMobileSidebarOpen(false); };

  return (
    <div className={"app-shell " + (appearance === "dark" ? "theme-dark" : "")}>
      {mobileSidebarOpen && <button className="mobile-backdrop" onClick={() => setMobileSidebarOpen(false)} aria-label="Close navigation" />}
      <aside className={"sidebar " + (!sidebarOpen ? "is-collapsed " : "") + (mobileSidebarOpen ? "mobile-open" : "")} aria-label="Conversation navigation">
        <div className="sidebar-brand-row">
          <a className="brand-lockup" href="/" onClick={(event) => { event.preventDefault(); startNewChat(); }} aria-label="Axiom home">
            <span className="brand-symbol"><Sparkles size={17} strokeWidth={2.2} /></span>
            <span className="brand-word">axi<em>om</em></span>
          </a>
          <button className="icon-button collapse-toggle" onClick={toggleSidebar} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}><PanelLeftClose size={17} /></button>
          <button className="icon-button mobile-close" onClick={() => setMobileSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button>
        </div>
        <div className="sidebar-actions">
          <button className="sidebar-action primary" onClick={startNewChat}><Plus size={17} /><span>New conversation</span></button>
          <button className="sidebar-action" onClick={() => { setMobileSidebarOpen(false); document.getElementById("chat-search")?.focus(); }}><Search size={16} /><span>Search history</span></button>
        </div>
        <section className="history-section" aria-label="Recent conversations">
          <div className="history-heading">Recent conversations</div>
          <label className="history-search"><Search size={14} /><input id="chat-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a conversation" aria-label="Search conversations" /></label>
          <div className="chat-list">
            {filteredChats.length ? filteredChats.map((chat) => (
              <div className={"chat-history-row " + (activeId === chat.id ? "active" : "")} key={chat.id}>
                <button className="chat-history-open" onClick={() => openChat(chat.id)} title={chat.title}><MessageCircle size={15} /><span>{chat.title}</span></button>
              </div>
            )) : <div className="empty-history">{search ? "No matching conversations" : "Your conversations will appear here."}</div>}
          </div>
        </section>
        <div className="sidebar-copy">Thoughtfully built for better work.</div>
        <div className="sidebar-footer">
          <div className="user-avatar">A</div>
          <div className="sidebar-footer-text"><strong>Axiom workspace</strong><span>Personal edition</span></div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild><button className="icon-button" aria-label="Workspace settings"><MoreHorizontal size={18} /></button></DropdownMenu.Trigger>
            <DropdownMenu.Portal><DropdownMenu.Content align="end" side="top" sideOffset={8} className="dropdown-content">
              <DropdownMenu.Item className="dropdown-item" onSelect={toggleAppearance}>{appearance === "dark" ? <Sun size={15} /> : <Moon size={15} />}{appearance === "dark" ? "Use light appearance" : "Use dark appearance"}</DropdownMenu.Item>
              <DropdownMenu.Item className="dropdown-item" onSelect={exportChat}><ArrowDownToLine size={15} />Export conversation</DropdownMenu.Item>
              <DropdownMenu.Separator className="dropdown-separator" />
              <DropdownMenu.Item className="dropdown-item" onSelect={clearHistory}><Trash2 size={15} />Clear history</DropdownMenu.Item>
            </DropdownMenu.Content></DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileSidebarOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
            <button className="icon-button desktop-sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar"><PanelLeftClose size={17} /></button>
            <div className="topbar-title">{activeChat?.title || "Axiom workspace"}</div>
            <ChevronDown size={14} className="title-caret" />
          </div>
          <div className="topbar-right">
            <div className="status-pill"><span className="status-dot" />{chatReady === false ? "Setup needed" : "Ready when you are"}</div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild><button className="icon-button" aria-label="Conversation actions"><MoreHorizontal size={19} /></button></DropdownMenu.Trigger>
              <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={7} className="dropdown-content">
                <DropdownMenu.Item className="dropdown-item" onSelect={startNewChat}><Plus size={15} />New conversation</DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" onSelect={exportChat}><ArrowDownToLine size={15} />Export conversation</DropdownMenu.Item>
                <DropdownMenu.Separator className="dropdown-separator" />
                <DropdownMenu.Item className="dropdown-item" onSelect={toggleAppearance}>{appearance === "dark" ? <Sun size={15} /> : <Moon size={15} />}{appearance === "dark" ? "Light appearance" : "Dark appearance"}</DropdownMenu.Item>
              </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        <div className="main-scroll" key={activeChat?.id || "welcome"}>
          {!activeChat ? (
            <div className="welcome-wrap" ref={welcomeRef}>
              <div className="welcome-orb"><Sparkles size={25} /></div>
              <p className="welcome-eyebrow">A clearer way forward</p>
              <h1 className="welcome-title" ref={titleRef}>What can I help you<br />figure out today?</h1>
              <p className="welcome-subtitle">A thoughtful space for ideas, research, and getting meaningful work done.</p>
              <div className="prompt-grid">
                {suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return <button key={suggestion.title} className="prompt-card" onClick={() => choosePrompt(suggestion.prompt)}>
                    <span className="prompt-icon"><Icon size={16} /></span><span className="prompt-copy"><strong>{suggestion.title}</strong><span>{suggestion.description}</span></span>
                  </button>;
                })}
              </div>
            </div>
          ) : (
            <div className="conversation" aria-live="polite">
              <AnimatePresence initial={false}>
                {messages.map((message, index) => (
                  <motion.article key={message.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.19, ease: "easeOut" }} className={"message-row " + (message.role === "user" ? "user" : "assistant")}>
                    {message.role === "assistant" && <div className="message-avatar"><Sparkles size={15} /></div>}
                    <div className="message-body">
                      {message.role === "assistant" && <div className="message-author">Axiom</div>}
                      {message.role === "user" ? <div className="user-bubble">{message.content}</div> : message.content ? (
                        <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown></div>
                      ) : <div className="thinking-row" aria-label="Thinking"><span /><span /><span /></div>}
                      {message.role === "assistant" && message.content && !(mutation.isPending && index === messages.length - 1 && message.content === "") && <div className="message-actions"><button className="message-action" onClick={() => void copyText(message.id, message.content)}>{copiedId === message.id ? <Check size={13} /> : <Copy size={13} />}{copiedId === message.id ? "Copied" : "Copy"}</button></div>}
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="composer-zone">
          <div className="composer-container">
            <form className="composer" onSubmit={handleFormSubmit}>
              {attachment && <div className="attachment-chip"><FileText size={14} /><span>{attachment.name} · {Math.max(1, Math.round(attachment.size / 1024))} KB</span><button type="button" className="icon-button" aria-label="Remove attachment" onClick={() => setAttachment(null)}><X size={13} /></button></div>}
              <textarea {...form.register("message")} ref={(element) => { form.register("message").ref(element); composerRef.current = element; }} onKeyDown={handleKeyDown} rows={1} placeholder="Message Axiom…" aria-label="Message Axiom" autoComplete="off" />
              <div className="composer-tools">
                <div className="composer-tool-group">
                  <input ref={fileInputRef} className="hidden-file-input" type="file" accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.log,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.css,.py,.sql,text/*" onChange={addAttachment} />
                  <button type="button" className="composer-tool labelled" onClick={() => fileInputRef.current?.click()} aria-label="Attach a text file"><Paperclip size={16} /><span>Attach</span></button>
                  <span className="composer-tool labelled"><Globe2 size={15} /><span>Thoughtful by design</span></span>
                </div>
                <div className="composer-tool-group">
                  {mutation.isPending ? <button type="button" className="composer-tool stop" onClick={stopGeneration} aria-label="Stop generating"><CircleStop size={16} /></button> : <button type="submit" className="composer-tool send" disabled={!draft.trim() && !attachment} aria-label="Send message"><ArrowUp size={18} strokeWidth={2.4} /></button>}
                </div>
              </div>
            </form>
            <div className="composer-hint">Axiom can make mistakes. Check important information.</div>
          </div>
        </div>
      </main>
    </div>
  );
}

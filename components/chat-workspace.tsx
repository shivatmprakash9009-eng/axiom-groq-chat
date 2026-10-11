"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  ArrowDownToLine,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  CircleStop,
  Code2,
  Command,
  Copy,
  Edit2,
  FileCode,
  FileJson,
  FileText,
  Lightbulb,
  LogIn,
  LogOut,
  type LucideIcon,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Paperclip,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { type ChangeEvent, type DragEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { CodeBlock } from "@/components/code-block";
import { SettingsModal } from "@/components/settings-modal";
import { ShortcutsModal } from "@/components/shortcuts-modal";
import type { ComposerValues, ConversationMessage } from "@/lib/ai/schema";
import { useUIStore } from "@/stores/ui-store";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
type Attachment = { name: string; content: string; size: number };

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });

const suggestions: { title: string; description: string; prompt: string; icon: LucideIcon }[] = [
  {
    title: "Plan something ambitious",
    description: "Turn a big goal into clear steps",
    prompt: "Help me turn a big goal into a practical, step-by-step plan with milestones.",
    icon: Lightbulb,
  },
  {
    title: "Build or debug code",
    description: "Work through a technical challenge",
    prompt: "Help me design a clean, production-ready solution to a technical problem. Ask for any missing context.",
    icon: Code2,
  },
  {
    title: "Write with clarity",
    description: "Shape an idea into compelling words",
    prompt: "Help me express an idea clearly and persuasively. Start by asking what the audience and goal are.",
    icon: PenLine,
  },
  {
    title: "Learn something deeply",
    description: "Make a difficult concept click",
    prompt: "Teach me a difficult concept from first principles, with examples and a short practice exercise.",
    icon: BookOpen,
  },
];

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 45 ? `${clean.slice(0, 44).trimEnd()}…` : clean || "New conversation";
}

export function ChatWorkspace({ guestMode = false }: { guestMode?: boolean }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeId, setActiveId] = useQueryState("c", parseAsString.withOptions({ history: "replace" }));
  const [search, setSearch] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatReady, setChatReady] = useState<boolean | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      // Some Android browsers use a desktop-sized CSS viewport even on phones.
      // Detect touch-first devices as mobile so the drawer never falls back to
      // the desktop collapsed rail on a handset.
      const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      setIsMobile(window.innerWidth <= 1024 || coarsePointer);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    const pointerQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
    pointerQuery.addEventListener("change", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      pointerQuery.removeEventListener("change", handleResize);
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const appearance = useUIStore((state) => state.appearance);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const settings = useUIStore((state) => state.settings);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const toggleAppearance = useUIStore((state) => state.toggleAppearance);
  const setSettingsModalOpen = useUIStore((state) => state.setSettingsModalOpen);
  const setShortcutsModalOpen = useUIStore((state) => state.setShortcutsModalOpen);
  const incrementStats = useUIStore((state) => state.incrementStats);

  const form = useForm<ComposerValues>({
    defaultValues: { message: "" },
  });
  const draft = form.watch("message") || "";

  const activeChat = chats.find((chat) => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];

  // Authentication is managed by Firebase. Chat history stays in memory until a backend is selected.
  useEffect(() => {
    let cancelled = false;
    if (guestMode) {
      setChats([]);
      setUserId(null);
      setHydrated(true);
    } else {
      try {
        const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
          if (cancelled) return;
          setUserId(user?.uid ?? null);
          setHydrated(true);
        }, () => {
          if (!cancelled) setHydrated(true);
        });
        fetch("/api/health", { cache: "no-store" })
          .then((response) => response.json())
          .then((data: { configured?: boolean }) => setChatReady(Boolean(data.configured)))
          .catch(() => setChatReady(false));
        return () => {
          cancelled = true;
          unsubscribe();
        };
      } catch {
        setHydrated(true);
        toast.error("Firebase Authentication is not configured", {
          description: "Add the Firebase web app environment variables in Vercel.",
        });
      }
    }

    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setChatReady(Boolean(data.configured)))
      .catch(() => setChatReady(false));
    try {
      const saved = localStorage.getItem("axiom.appearance");
      if (saved === "dark" || saved === "light") useUIStore.getState().setAppearance(saved);
    } catch {
      // Browser storage may be unavailable.
    }
    return () => { cancelled = true; };
  }, [guestMode]);

  // Persist appearance
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("axiom.appearance", appearance);
    } catch {
      // ignore
    }
  }, [appearance, hydrated]);

  // Welcome animation
  useEffect(() => {
    if (!activeChat && titleRef.current && welcomeRef.current) {
      const context = gsap.context(() => {
        gsap.fromTo(titleRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.52, ease: "power3.out" });
      }, welcomeRef);
      return () => context.revert();
    }
    return undefined;
  }, [activeChat]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, activeId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("chat-search")?.focus();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        startNewChat();
      } else if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        setSettingsModalOpen(true);
      } else if (e.key === "Escape") {
        setSettingsModalOpen(false);
        setShortcutsModalOpen(false);
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [setSettingsModalOpen, setShortcutsModalOpen, setMobileSidebarOpen]);

  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    return chats.filter(
      (chat) =>
        !term ||
        chat.title.toLowerCase().includes(term) ||
        chat.messages.some((m) => m.content.toLowerCase().includes(term))
    );
  }, [chats, search]);

  const startNewChat = () => {
    setActiveId(null);
    setMobileSidebarOpen(false);
    form.reset({ message: "" });
    setAttachment(null);
    window.setTimeout(() => composerRef.current?.focus(), 50);
  };

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
  };

  // Core generation function (supports SSE streaming and JSON fallback)
  const executeGeneration = async (chatId: string, placeholderId: string, historyToSend: ConversationMessage[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(!guestMode && getFirebaseAuth().currentUser
            ? { Authorization: `Bearer ${await getFirebaseAuth().currentUser!.getIdToken()}` }
            : {}),
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyToSend,
          stream: settings.streamResponses,
          style: settings.chatStyle,
          customSystemPrompt: settings.customSystemPrompt || undefined,
          temperature: settings.temperature,
          guestMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `TIWAT request failed (status ${response.status})`);
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle SSE streaming response
      if (contentType.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              let chunk: { error?: string; text?: string };
              try {
                chunk = JSON.parse(dataStr) as { error?: string; text?: string };
              } catch {
                // Ignore malformed or incomplete SSE data lines only.
                continue;
              }

              // Handle server errors outside the JSON parse catch. Otherwise
              // throwing here is swallowed and the UI falsely says no response.
              if (chunk.error) {
                throw new Error(chunk.error);
              }

              if (typeof chunk.text === "string" && chunk.text.length > 0) {
                accumulated += chunk.text;
                setChats((current) =>
                  current.map((chat) =>
                    chat.id !== chatId
                      ? chat
                      : {
                          ...chat,
                          updatedAt: Date.now(),
                          messages: chat.messages.map((m) =>
                            m.id === placeholderId ? { ...m, content: accumulated } : m
                          ),
                        }
                  )
                );
              }
            }
          }
        }

        // Finalize completed chat
        setChats((current) =>
          current.map((chat) =>
            chat.id !== chatId
              ? chat
              : {
                  ...chat,
                  updatedAt: Date.now(),
                  messages: chat.messages.map((m) =>
                    m.id === placeholderId ? { ...m, content: accumulated || "No response received." } : m
                  ),
                }
          ).sort((a, b) => b.updatedAt - a.updatedAt)
        );
      } else {
        // Handle standard JSON response
        const data = await response.json();
        if (!data.message) {
          throw new Error(data.error || "TIWAT returned an empty response.");
        }

        setChats((current) =>
          current.map((chat) =>
            chat.id !== chatId
              ? chat
              : {
                  ...chat,
                  updatedAt: Date.now(),
                  messages: chat.messages.map((m) =>
                    m.id === placeholderId ? { ...m, content: data.message } : m
                  ),
                }
          ).sort((a, b) => b.updatedAt - a.updatedAt)
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User voluntarily aborted
        return;
      }
      const errorMsg = err instanceof Error ? err.message : "Something went wrong.";
      setChats((current) =>
        current.map((chat) =>
          chat.id !== chatId
            ? chat
            : {
                ...chat,
                messages: chat.messages.map((m) =>
                  m.id === placeholderId ? { ...m, content: `Error: ${errorMsg}` } : m
                ),
              }
        )
      );
      toast.error("Could not complete response", { description: errorMsg });
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const onSend = async ({ message }: ComposerValues) => {
    if (isGenerating) return;
    const text = message.trim();
    if (!text && !attachment) return;

    const apiPrompt =
      text + (attachment ? `\n\n[Attached text file: ${attachment.name}]\n${attachment.content}` : "");
    const chatId = activeChat?.id || uid();
    const placeholderId = uid();
    const userMessage: Message = {
      id: uid(),
      role: "user",
      content: text + (attachment ? `\n\nAttached file: ${attachment.name}` : ""),
    };
    const placeholder: Message = { id: placeholderId, role: "assistant", content: "" };
    const prior = activeChat?.messages || [];

    incrementStats(apiPrompt.length);

    if (activeChat) {
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? { ...chat, updatedAt: Date.now(), messages: [...chat.messages, userMessage, placeholder] }
            : chat
        )
      );
    } else {
      setChats((current) => [
        {
          id: chatId,
          title: titleFrom(text || attachment?.name || "New conversation"),
          messages: [userMessage, placeholder],
          updatedAt: Date.now(),
        },
        ...current,
      ].slice(0, MAX_HISTORY));
      void setActiveId(chatId);
    }

    form.reset({ message: "" });
    setAttachment(null);
    setMobileSidebarOpen(false);

    const historyToSend: ConversationMessage[] = [
      ...prior.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: apiPrompt },
    ].slice(-32);

    void executeGeneration(chatId, placeholderId, historyToSend);
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
    window.setTimeout(() => {
      void handleFormSubmit();
    }, 0);
  };

  const handleRegenerate = (assistantMessageId: string) => {
    if (!activeChat || isGenerating) return;
    const messageIndex = activeChat.messages.findIndex((m) => m.id === assistantMessageId);
    if (messageIndex <= 0) return;

    // Slice history up to user message right before this assistant message
    const priorMessages = activeChat.messages.slice(0, messageIndex);
    const placeholderId = uid();

    setChats((current) =>
      current.map((c) =>
        c.id !== activeChat.id
          ? c
          : {
              ...c,
              messages: [...priorMessages, { id: placeholderId, role: "assistant", content: "" }],
            }
      )
    );

    const historyToSend: ConversationMessage[] = priorMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    void executeGeneration(activeChat.id, placeholderId, historyToSend);
  };

  const handleEditMessage = (userContent: string) => {
    form.setValue("message", userContent);
    composerRef.current?.focus();
    toast.info("Prompt loaded into composer for editing");
  };

  // Drag and drop attachment handler
  const handleDragOver = (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFile = async (file: File) => {
    if (file.size > 250_000) {
      toast.error("File is too large", { description: "Please attach a text file smaller than 250 KB." });
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = [
      "txt", "md", "markdown", "csv", "json", "html", "htm", "log", "xml", "yaml", "yml", "ts", "tsx", "js", "jsx", "css", "py", "sql", "sh"
    ];
    if (!allowed.includes(extension) && !file.type.startsWith("text/")) {
      toast.error("Unsupported file format", {
        description: "TIWAT accepts text, code, CSV, JSON, Markdown, and configuration files.",
      });
      return;
    }
    try {
      const content = await file.text();
      setAttachment({ name: file.name, content, size: file.size });
      toast.success("File attached", { description: file.name });
    } catch {
      toast.error("Couldn't read file contents.");
    }
  };

  const handleDrop = async (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const addAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      await processFile(file);
    }
  };

  const copyText = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Clipboard access unavailable.");
    }
  };

  const exportChatMarkdown = () => {
    if (!activeChat) {
      toast.info("Open a conversation to export it.");
      return;
    }
    const content = `# ${activeChat.title}\n\n${activeChat.messages
      .map((m) => `## ${m.role === "user" ? "User" : "TIWAT"}\n\n${m.content}`)
      .join("\n\n---\n\n")}`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${titleFrom(activeChat.title).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation exported as Markdown");
  };

  const exportChatJSON = () => {
    if (!activeChat) {
      toast.info("Open a conversation to export it.");
      return;
    }
    const blob = new Blob([JSON.stringify(activeChat, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${titleFrom(activeChat.title).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation exported as JSON");
  };

  const deleteChat = (id: string) => {
    setChats((current) => current.filter((c) => c.id !== id));
    if (activeId === id) {
      void setActiveId(null);
    }
    toast.success("Conversation deleted");
  };

  const startRename = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditTitleValue(chat.title);
  };

  const saveRename = (id: string) => {
    if (!editTitleValue.trim()) return;
    setChats((current) =>
      current.map((c) => (c.id === id ? { ...c, title: editTitleValue.trim() } : c))
    );
    setEditingChatId(null);
  };

  const clearHistory = () => {
    setChats([]);
    void setActiveId(null);
    if (guestMode) {
      toast.success("Temporary guest conversation cleared");
      return;
    }
    toast.success("Conversation history cleared");
  };

  const openChat = (id: string) => {
    void setActiveId(id);
    setMobileSidebarOpen(false);
  };

  return (
    <div className={`app-shell ${appearance === "dark" ? "theme-dark" : ""}`}>
      {/* Modals */}
      <SettingsModal />
      <ShortcutsModal />

      <button
        type="button"
        className={`mobile-backdrop ${mobileSidebarOpen ? "is-visible" : ""}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-label="Close navigation"
        tabIndex={mobileSidebarOpen ? 0 : -1}
        aria-hidden={!mobileSidebarOpen}
      />

      {/* Sidebar */}
      <aside
        className={`sidebar ${!isMobile && !sidebarOpen ? "is-collapsed " : ""}${mobileSidebarOpen ? "mobile-open" : ""}`}
        aria-label="Conversation navigation"
      >
        <div className="sidebar-brand-row">
          <a
            className="brand-lockup"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              startNewChat();
            }}
            aria-label="TIWAT home"
          >
            <span className="brand-symbol">
              <Sparkles size={17} strokeWidth={2.2} />
            </span>
            <span className="brand-word">
              tiw<em>at</em>
            </span>
          </a>
          {!isMobile && (
            <button
              type="button"
              className="icon-button collapse-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <PanelLeftClose size={17} />
            </button>
          )}
          <button
            type="button"
            className="icon-button mobile-close"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-actions">
          <button type="button" className="sidebar-action primary" onClick={startNewChat}>
            <Plus size={17} />
            <span>New conversation</span>
          </button>
          <button
            type="button"
            className="sidebar-action"
            onClick={() => {
              setMobileSidebarOpen(false);
              document.getElementById("chat-search")?.focus();
            }}
          >
            <Search size={16} />
            <span>Search history</span>
          </button>
        </div>

        <section className="history-section" aria-label="Recent conversations">
          <div className="history-heading flex items-center justify-between">
            <span>Conversations</span>
            <span className="text-[10px] opacity-75 font-mono">{chats.length}</span>
          </div>
          <label className="history-search">
            <Search size={14} />
            <input
              id="chat-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations (⌘K)"
              aria-label="Search conversations"
            />
          </label>
          <div className="chat-list">
            {filteredChats.length ? (
              filteredChats.map((chat) => (
                <div
                  className={`chat-history-row group relative ${activeId === chat.id ? "active" : ""}`}
                  key={chat.id}
                >
                  {editingChatId === chat.id ? (
                    <div className="flex items-center w-full px-2 gap-1.5 py-1">
                      <input
                        type="text"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(chat.id);
                          if (e.key === "Escape") setEditingChatId(null);
                        }}
                        ref={(el) => el?.focus()}
                        className="flex-1 bg-[var(--surface-soft)] text-xs text-[var(--text)] px-2 py-1 rounded border border-[var(--line)] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveRename(chat.id)}
                        className="p-1 text-emerald-500 hover:opacity-80"
                        aria-label="Save title"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="chat-history-open"
                        onClick={() => openChat(chat.id)}
                        title={chat.title}
                      >
                        <MessageCircle size={15} />
                        <span>{chat.title}</span>
                      </button>
                      <div className="hidden group-hover:flex items-center gap-1 pr-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(chat);
                          }}
                          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text)] rounded"
                          title="Rename"
                          aria-label="Rename conversation"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChat(chat.id);
                          }}
                          className="p-1 text-[var(--text-tertiary)] hover:text-red-500 rounded"
                          title="Delete"
                          aria-label="Delete conversation"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-history">
                {search ? "No matching conversations" : "Your conversations will appear here."}
              </div>
            )}
          </div>
        </section>

        <div className="sidebar-copy">Thoughtfully built for high-leverage work.</div>

        <div className="sidebar-footer">
          <div className="user-avatar">{guestMode ? "G" : "T"}</div>
          <div className="sidebar-footer-text">
            <strong>{guestMode ? "Guest session" : "Your TIWAT workspace"}</strong>
            <span>{guestMode ? "Temporary · Not saved" : `${settings.chatStyle} Mode`}</span>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="icon-button" aria-label="Workspace settings menu">
                <MoreHorizontal size={18} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" side="top" sideOffset={8} className="dropdown-content">
                <DropdownMenu.Item
                  className="dropdown-item"
                  onSelect={() => setSettingsModalOpen(true)}
                >
                  <Settings size={15} />
                  Workspace settings
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-item"
                  onSelect={() => setShortcutsModalOpen(true)}
                >
                  <Command size={15} />
                  Keyboard shortcuts
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="dropdown-separator" />
                {guestMode ? (
                  <DropdownMenu.Item className="dropdown-item" onSelect={() => { window.location.href = "/login"; }}>
                    <LogIn size={15} /> Sign in to save chats
                  </DropdownMenu.Item>
                ) : (
                  <DropdownMenu.Item className="dropdown-item" onSelect={() => { void signOut(getFirebaseAuth()).finally(() => { window.location.href = "/login"; }); }}>
                    <LogOut size={15} /> Sign out
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="dropdown-separator" />
                <DropdownMenu.Item className="dropdown-item" onSelect={toggleAppearance}>
                  {appearance === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                  {appearance === "dark" ? "Use light appearance" : "Use dark appearance"}
                </DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" onSelect={exportChatMarkdown}>
                  <FileCode size={15} />
                  Export as Markdown
                </DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" onSelect={exportChatJSON}>
                  <FileJson size={15} />
                  Export as JSON
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="dropdown-separator" />
                <DropdownMenu.Item className="dropdown-item text-red-500" onSelect={clearHistory}>
                  <Trash2 size={15} />
                  Clear all history
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button mobile-menu"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              className="icon-button desktop-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <PanelLeftClose size={17} className={!sidebarOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            <div className="topbar-title">{activeChat?.title || "TIWAT Workspace"}</div>
            <ChevronDown size={14} className="title-caret" />
          </div>
          <div className="topbar-right">
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="status-pill hover:border-[var(--accent)] cursor-pointer transition-colors"
              title="Click to view workspace settings"
            >
              <span className="status-dot" />
              {chatReady === false ? "Setup needed" : `TIWAT · ${settings.chatStyle}`}
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="icon-button" aria-label="Conversation actions">
                  <MoreHorizontal size={19} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={7} className="dropdown-content">
                  <DropdownMenu.Item className="dropdown-item" onSelect={startNewChat}>
                    <Plus size={15} />
                    New conversation
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="dropdown-item" onSelect={exportChatMarkdown}>
                    <ArrowDownToLine size={15} />
                    Export conversation
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="dropdown-item"
                    onSelect={() => setSettingsModalOpen(true)}
                  >
                    <Settings size={15} />
                    Workspace settings
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="dropdown-separator" />
                  <DropdownMenu.Item className="dropdown-item" onSelect={toggleAppearance}>
                    {appearance === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                    {appearance === "dark" ? "Light appearance" : "Dark appearance"}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        {/* Scrollable Conversation View */}
        <div className="main-scroll" key={activeChat?.id || "welcome"}>
          {!activeChat ? (
            <div className="welcome-wrap" ref={welcomeRef}>
              <div className="welcome-orb">
                <Sparkles size={25} />
              </div>
              <p className="welcome-eyebrow">A calmer way forward</p>
              <h1 className="welcome-title" ref={titleRef}>
                What can I help you
                <br />
                figure out today?
              </h1>
              <p className="welcome-subtitle">
                A thoughtful workspace for complex ideas, deep research, and high-impact work.
              </p>
              <div className="prompt-grid">
                {suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      type="button"
                      key={suggestion.title}
                      className="prompt-card"
                      onClick={() => choosePrompt(suggestion.prompt)}
                    >
                      <span className="prompt-icon">
                        <Icon size={16} />
                      </span>
                      <span className="prompt-copy">
                        <strong>{suggestion.title}</strong>
                        <span>{suggestion.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="conversation" aria-live="polite">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.article
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.19, ease: "easeOut" }}
                    className={`message-row ${message.role === "user" ? "user" : "assistant"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="message-avatar">
                        <Sparkles size={15} />
                      </div>
                    )}
                    <div className="message-body">
                      {message.role === "assistant" && (
                        <div className="message-author flex items-center justify-between">
                          <span>TIWAT</span>
                        </div>
                      )}
                      {message.role === "user" ? (
                        <div className="group relative">
                          <div className="user-bubble">{message.content}</div>
                          <div className="message-actions opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              type="button"
                              className="message-action"
                              onClick={() => handleEditMessage(message.content)}
                              title="Edit prompt"
                              aria-label="Edit message"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="message-action"
                              onClick={() => void copyText(message.id, message.content)}
                              aria-label="Copy prompt"
                            >
                              {copiedId === message.id ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedId === message.id ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        </div>
                      ) : message.content ? (
                        <div className="markdown-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              code({ className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || "");
                                const codeString = String(children).replace(/\n$/, "");
                                if (match || codeString.includes("\n")) {
                                  return (
                                    <CodeBlock language={match?.[1] || "code"}>
                                      {codeString}
                                    </CodeBlock>
                                  );
                                }
                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="thinking-row" role="status" aria-label="Thinking">
                          <span />
                          <span />
                          <span />
                        </div>
                      )}
                      {message.role === "assistant" && message.content && (
                        <div className="message-actions">
                          <button
                            type="button"
                            className="message-action"
                            onClick={() => void copyText(message.id, message.content)}
                            aria-label="Copy response"
                          >
                            {copiedId === message.id ? <Check size={13} /> : <Copy size={13} />}
                            <span>{copiedId === message.id ? "Copied" : "Copy"}</span>
                          </button>
                          <button
                            type="button"
                            className="message-action"
                            onClick={() => handleRegenerate(message.id)}
                            disabled={isGenerating}
                            aria-label="Regenerate response"
                          >
                            <RefreshCw size={12} />
                            <span>Regenerate</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer Zone with Drag-and-Drop */}
        <div className="composer-zone">
          <div className="composer-container">
            <form
              className={`composer transition-all ${isDragOver ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : ""}`}
              onSubmit={handleFormSubmit}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {attachment && (
                <div className="attachment-chip">
                  <FileText size={14} />
                  <span>
                    {attachment.name} · {Math.max(1, Math.round(attachment.size / 1024))} KB
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove attachment"
                    onClick={() => setAttachment(null)}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <textarea
                {...form.register("message")}
                ref={(element) => {
                  form.register("message").ref(element);
                  composerRef.current = element;
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={isDragOver ? "Drop file to attach…" : "Message TIWAT… (Enter to send, Shift+Enter for newline)"}
                aria-label="Message TIWAT"
                autoComplete="off"
              />
              <div className="composer-tools">
                <div className="composer-tool-group">
                  <input
                    ref={fileInputRef}
                    className="hidden-file-input"
                    type="file"
                    accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.log,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.css,.py,.sql,.sh,text/*"
                    onChange={addAttachment}
                  />
                  <button
                    type="button"
                    className="composer-tool labelled"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach a text or code file"
                  >
                    <Paperclip size={16} />
                    <span>Attach</span>
                  </button>
                  <button
                    type="button"
                    className="composer-tool labelled"
                    onClick={() => setShortcutsModalOpen(true)}
                    aria-label="Keyboard shortcuts"
                  >
                    <Command size={14} />
                    <span>Shortcuts</span>
                  </button>
                </div>
                <div className="composer-tool-group">
                  {isGenerating ? (
                    <button
                      type="button"
                      className="composer-tool stop"
                      onClick={stopGeneration}
                      aria-label="Stop generating"
                    >
                      <CircleStop size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="composer-tool send"
                      disabled={!draft.trim() && !attachment}
                      aria-label="Send message"
                    >
                      <ArrowUp size={18} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </div>
            </form>
            <div className="composer-hint flex items-center justify-center gap-2">
              <span>TIWAT can make mistakes. Verify important facts.</span>
              <span>·</span>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(true)}
                className="underline hover:text-[var(--text)] transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

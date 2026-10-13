"use client";

import { onAuthStateChanged, signOut, type User } from "@firebase/auth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  Command,
  Copy,
  FileCode,
  FileJson,
  FileText,
  Globe,
  Lightbulb,
  LogIn,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { MarkdownContent, TypewriterMarkdown } from "@/components/markdown-content";
import { ShortcutsModal } from "@/components/shortcuts-modal";
import { TiwatLogo } from "@/components/tiwat-logo";
import type { ComposerValues, ConversationMessage } from "@/lib/ai/schema";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useUIStore } from "@/stores/ui-store";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
type Attachment = { name: string; content: string; size: number };

const STORAGE_KEY = "tiwat.chats.v1";
const FALLBACK_KEYS = ["axiom.workspace.chats.v3", "axiom.groq-chat.v2"];
const MAX_HISTORY = 100;
/** Within this distance of the bottom, the view keeps following new text. */
const NEAR_BOTTOM_PX = 24;

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });

const promptSuggestions = [
  {
    title: "Explore an idea",
    subtitle: "Generate ideas and creative concepts",
    prompt: "Generate a creative concept and detailed description for a modern minimalist illustration.",
    icon: Sparkles,
  },
  {
    title: "Analyze data",
    subtitle: "Find patterns & calculate insights",
    prompt: "Help me write a Python script to analyze, clean, and visualize a dataset step by step.",
    icon: Code2,
  },
  {
    title: "Summarize text",
    subtitle: "Distill complex reports & articles",
    prompt: "Summarize this topic into key takeaways, pros and cons, and an action plan.",
    icon: FileText,
  },
  {
    title: "Write or edit",
    subtitle: "Draft content and refine ideas",
    prompt: "Help me craft a clear, compelling proposal tailored to an executive audience.",
    icon: PenLine,
  },
];

const availableModels = [
  {
    id: "tiwat-balanced",
    name: "TIWAT Balanced",
    badge: "Balanced",
    description: "Clear, balanced responses for everyday work.",
    style: "default" as const,
  },
  {
    id: "tiwat-detailed",
    name: "TIWAT Detailed",
    badge: "In-depth",
    description: "More context, examples, and step-by-step detail.",
    style: "detailed" as const,
  },
  {
    id: "tiwat-code",
    name: "TIWAT Code",
    badge: "Engineering",
    description: "Technical explanations and code-focused responses.",
    style: "code" as const,
  },
  {
    id: "tiwat-concise",
    name: "TIWAT Concise",
    badge: "Brief",
    description: "Short, direct responses without filler.",
    style: "concise" as const,
  },
];

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 40 ? `${clean.slice(0, 39).trimEnd()}…` : clean || "New chat";
}

function readHistory(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const k of FALLBACK_KEYS) {
        raw = localStorage.getItem(k);
        if (raw) break;
      }
    }
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is Chat => Boolean(entry && typeof entry.id === "string" && Array.isArray(entry.messages)))
      .map((entry) => ({
        id: entry.id,
        title: String(entry.title || "New chat"),
        updatedAt: Number(entry.updatedAt || Date.now()),
        messages: entry.messages.filter(
          (m: Message) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
        ),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function groupChatsByDate(chats: Chat[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const sevenDaysAgo = today - 7 * 86400000;
  const thirtyDaysAgo = today - 30 * 86400000;

  const groups: { [key: string]: Chat[] } = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };

  for (const chat of chats) {
    const time = chat.updatedAt || 0;
    if (time >= today) {
      groups.Today.push(chat);
    } else if (time >= yesterday) {
      groups.Yesterday.push(chat);
    } else if (time >= sevenDaysAgo) {
      groups["Previous 7 Days"].push(chat);
    } else if (time >= thirtyDaysAgo) {
      groups["Previous 30 Days"].push(chat);
    } else {
      groups.Older.push(chat);
    }
  }

  return Object.entries(groups).filter(([_, items]) => items.length > 0);
}

export function ChatWorkspace({ guestMode = false }: { guestMode?: boolean }) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cloudHistoryReady, setCloudHistoryReady] = useState(false);
  const [activeId, setActiveId] = useQueryState("c", parseAsString.withOptions({ history: "replace" }));
  const [search, setSearch] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [thumbsState, setThumbsState] = useState<Record<string, "up" | "down">>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [animatedMessageId, setAnimatedMessageId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("tiwat-balanced");
  const [detailedStyleEnabled, setDetailedStyleEnabled] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const centerComposerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const appearance = useUIStore((state) => state.appearance);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const settings = useUIStore((state) => state.settings);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const toggleAppearance = useUIStore((state) => state.toggleAppearance);
  const setShortcutsModalOpen = useUIStore((state) => state.setShortcutsModalOpen);
  const updateSettings = useUIStore((state) => state.updateSettings);
  const incrementStats = useUIStore((state) => state.incrementStats);

  const form = useForm<ComposerValues>({
    defaultValues: { message: "" },
  });
  const draft = form.watch("message") || "";

  const activeChat = chats.find((chat) => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];

  // Responsive device check
  useEffect(() => {
    const handleResize = () => {
      const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      setIsMobile(window.innerWidth <= 1024 || coarsePointer);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Hydration & initial load
  useEffect(() => {
    setChats(readHistory());
    setHydrated(true);

    useUIStore.getState().hydrateAppearance();

    try {
      const rawPreferences = localStorage.getItem("tiwat.preferences.v1");
      if (rawPreferences) {
        const preferences = JSON.parse(rawPreferences) as {
          chatStyle?: "default" | "concise" | "detailed" | "code";
          customSystemPrompt?: string;
          temperature?: number;
          streamResponses?: boolean;
        };
        useUIStore.getState().updateSettings({
          ...(preferences.chatStyle ? { chatStyle: preferences.chatStyle } : {}),
          ...(typeof preferences.customSystemPrompt === "string" ? { customSystemPrompt: preferences.customSystemPrompt } : {}),
          ...(typeof preferences.temperature === "number" ? { temperature: preferences.temperature } : {}),
          ...(typeof preferences.streamResponses === "boolean" ? { streamResponses: preferences.streamResponses } : {}),
        });
      }
    } catch {
      // Ignore unavailable or malformed saved preferences.
    }

    if (!guestMode) {
      try {
        const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
          setFirebaseUser(user);
        });
        return () => unsubscribe();
      } catch {
        // Firebase not fully initialized
      }
    }
  }, [guestMode]);

  // Persist chats locally for guest/offline continuity.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_HISTORY)));
    } catch {
      // ignore
    }
  }, [chats, hydrated]);

  // Load the signed-in user's history from the server.
  useEffect(() => {
    if (guestMode || !hydrated || !firebaseUser) {
      setCloudHistoryReady(false);
      return;
    }
    let cancelled = false;
    setCloudHistoryReady(false);
    void (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch("/api/chats", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!response.ok) { const result = await response.json().catch(() => null) as { error?: unknown } | null; throw new Error(typeof result?.error === "string" ? result.error : `Cloud history load failed (HTTP ${response.status}).`); }
        const data = await response.json() as { chats?: Array<{ id: string; title: string; messages: Message[]; updated_at: string }> };
        if (cancelled) return;
        const remote = (data.chats || []).map((chat) => ({
          id: chat.id, title: chat.title || "New chat",
          messages: Array.isArray(chat.messages) ? chat.messages : [],
          updatedAt: Date.parse(chat.updated_at) || Date.now(),
        })).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_HISTORY);
        if (remote.length) {
          setChats(remote);
        } else {
          const local = readHistory();
          if (local.length) {
            const upload = await fetch("/api/chats", {
              method: "PUT",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ chats: local.map((chat) => ({ id: chat.id, title: chat.title, messages: chat.messages, updated_at: new Date(chat.updatedAt).toISOString() })) }),
            });
            if (!upload.ok) { const result = await upload.json().catch(() => null) as { error?: unknown } | null; throw new Error(typeof result?.error === "string" ? result.error : `Local history migration failed (HTTP ${upload.status}).`); }
            if (!cancelled) setChats(local);
          }
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Cloud chat sync failed.");
      } finally {
        if (!cancelled) setCloudHistoryReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [firebaseUser, guestMode, hydrated]);

  // Keep signed-in chat history synced to Supabase; guest history stays local.
  useEffect(() => {
    if (guestMode || !firebaseUser || !hydrated || !cloudHistoryReady) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await firebaseUser.getIdToken();
          const response = await fetch("/api/chats", {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ chats: chats.slice(0, MAX_HISTORY).map((chat) => ({ id: chat.id, title: chat.title, messages: chat.messages, updated_at: new Date(chat.updatedAt).toISOString() })) }),
          });
          if (!response.ok) { const result = await response.json().catch(() => null) as { error?: unknown } | null; throw new Error(typeof result?.error === "string" ? result.error : `Chat history sync failed (HTTP ${response.status}).`); }
        } catch (error) {
          console.error("[TIWAT] Cloud chat sync failed", error);
          toast.error("Cloud chat sync failed. Your local history is still available on this device.");
        }
      })();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [chats, cloudHistoryReady, firebaseUser, guestMode, hydrated]);

  // Stop any reply still in flight when leaving the workspace.
  useEffect(() => () => abortRef.current?.abort(), []);

  const hasMessages = messages.length > 0;

  const scrollToLatest = (behavior: ScrollBehavior) => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior });
  };

  const handleScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const scrolledUp = scroller.scrollTop < lastScrollTopRef.current - 1;
    lastScrollTopRef.current = scroller.scrollTop;

    if (distanceFromBottom <= NEAR_BOTTOM_PX) {
      stickToBottomRef.current = true;
      setShowJumpToLatest(false);
    } else if (scrolledUp) {
      // The reader scrolled up on purpose: stop following new text until they come back.
      stickToBottomRef.current = false;
      setShowJumpToLatest(true);
    }
  };

  const jumpToLatest = () => {
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    scrollToLatest(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  };

  // Opening a chat always lands on its latest message.
  useEffect(() => {
    stickToBottomRef.current = true;
    lastScrollTopRef.current = 0;
    setShowJumpToLatest(false);
    scrollToLatest("auto");
  }, [activeId]);

  // Sending a message (or regenerating) re-engages follow mode.
  useEffect(() => {
    if (!messages.length) return;
    stickToBottomRef.current = true;
    scrollToLatest(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  }, [messages.length]);

  // Follow the reply as it grows (streaming, typing, code blocks, images) while the reader is at the bottom.
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [activeId, hasMessages]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("sidebar-search")?.focus();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        startNewChat();
      } else if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        openSettings();
      } else if (e.key === "Escape") {
        setShortcutsModalOpen(false);
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [setShortcutsModalOpen, setMobileSidebarOpen]);

  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    return chats.filter(
      (chat) =>
        !term ||
        chat.title.toLowerCase().includes(term) ||
        chat.messages.some((m) => m.content.toLowerCase().includes(term))
    );
  }, [chats, search]);

  const groupedChats = useMemo(() => {
    return groupChatsByDate(filteredChats);
  }, [filteredChats]);

  const currentModel = useMemo(() => {
    return (
      availableModels.find((model) => model.id === selectedModelId && model.style === settings.chatStyle) ||
      availableModels.find((model) => model.style === settings.chatStyle) ||
      availableModels[0]
    );
  }, [selectedModelId, settings.chatStyle]);

  const selectModel = (model: (typeof availableModels)[number]) => {
    setSelectedModelId(model.id);
    updateSettings({ chatStyle: model.style });
    toast.info(`Switched to ${model.name}`);
  };

  const openSettings = () => {
    setMobileSidebarOpen(false);
    router.push("/settings");
  };

  const startNewChat = () => {
    void setActiveId(null);
    setMobileSidebarOpen(false);
    form.reset({ message: "" });
    setAttachment(null);
    window.setTimeout(() => {
      centerComposerRef.current?.focus();
      composerRef.current?.focus();
    }, 50);
  };

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
  };

  const executeGeneration = async (
    chatId: string,
    placeholderId: string,
    historyToSend: ConversationMessage[]
  ) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setAnimatedMessageId(placeholderId);

    try {
      let authHeader: Record<string, string> = {};
      if (!guestMode) {
        try {
          const user = getFirebaseAuth().currentUser;
          if (user) {
            const token = await user.getIdToken();
            authHeader = { Authorization: `Bearer ${token}` };
          }
        } catch {
          // ignore
        }
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyToSend,
          stream: settings.streamResponses,
          style: detailedStyleEnabled ? "detailed" : settings.chatStyle,
          customSystemPrompt: settings.customSystemPrompt || undefined,
          temperature: settings.temperature,
          language: (() => {
            try {
              const raw = localStorage.getItem("tiwat.preferences.v1");
              const preference = raw ? JSON.parse(raw) as { language?: unknown } : null;
              return typeof preference?.language === "string" ? preference.language : "English";
            } catch { return "English"; }
          })(),
          guestMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `TIWAT request failed (status ${response.status})`);
      }

      const contentType = response.headers.get("content-type") || "";

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
                continue;
              }

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

        if (!accumulated.trim()) {
          throw new Error("TIWAT stream ended without a response. Please try again.");
        }

        setChats((current) =>
          current
            .map((chat) =>
              chat.id !== chatId
                ? chat
                : {
                    ...chat,
                    updatedAt: Date.now(),
                    messages: chat.messages.map((m) =>
                      m.id === placeholderId
                        ? { ...m, content: accumulated }
                        : m
                    ),
                  }
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)
        );
      } else {
        const data = await response.json();
        if (!data.message) {
          throw new Error(data.error || "TIWAT returned an empty response.");
        }

        setChats((current) =>
          current
            .map((chat) =>
              chat.id !== chatId
                ? chat
                : {
                    ...chat,
                    updatedAt: Date.now(),
                    messages: chat.messages.map((m) =>
                      m.id === placeholderId ? { ...m, content: data.message } : m
                    ),
                  }
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
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

    let apiPrompt = text;
    if (attachment) {
      apiPrompt = `${text}\n\n[Attached File: ${attachment.name}]\n${attachment.content}`;
    }

    const chatId = activeChat?.id || uid();
    const placeholderId = uid();
    const userMessage: Message = {
      id: uid(),
      role: "user",
      content: text + (attachment ? `\n\n📎 Attached file: ${attachment.name}` : ""),
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
          title: titleFrom(text || attachment?.name || "New chat"),
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

  const choosePrompt = (promptText: string) => {
    form.setValue("message", promptText, { shouldDirty: true, shouldValidate: true });
    window.setTimeout(() => {
      void handleFormSubmit();
    }, 0);
  };

  const handleRegenerate = (assistantMessageId: string) => {
    if (!activeChat || isGenerating) return;
    const messageIndex = activeChat.messages.findIndex((m) => m.id === assistantMessageId);
    if (messageIndex <= 0) return;

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

  const handleFeedback = (id: string, type: "up" | "down") => {
    setThumbsState((prev) => {
      const next = { ...prev };
      if (next[id] === type) {
        delete next[id];
      } else {
        next[id] = type;
      }
      return next;
    });
    toast.success("Thank you for the feedback!");
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

  const processFile = async (file: File) => {
    if (file.size > 250_000) {
      toast.error("File is too large", { description: "Please attach a text file smaller than 250 KB." });
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = [
      "txt", "md", "markdown", "csv", "json", "html", "htm", "log", "xml", "yaml", "yml", "ts", "tsx", "js", "jsx", "css", "py", "sql", "sh",
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

  const handleDragOver = (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
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
    if (!guestMode && firebaseUser) {
      void firebaseUser.getIdToken().then((token) => fetch("/api/chats", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })).catch((error) => console.error("[TIWAT] Cloud chat deletion failed", error));
    }
    if (activeId === id) void setActiveId(null);
    toast.success("Chat deleted");
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
    const ids = chats.map((chat) => chat.id);
    setChats([]);
    if (!guestMode && firebaseUser) {
      void firebaseUser.getIdToken().then(async (token) => {
        await Promise.all(ids.map((id) => fetch("/api/chats", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })));
      }).catch((error) => console.error("[TIWAT] Cloud history clear failed", error));
    }
    void setActiveId(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    toast.success("Chat history cleared");
  };

  const openChat = (id: string) => {
    void setActiveId(id);
    setMobileSidebarOpen(false);
  };

  return (
    <div
      className={`app-shell ${appearance === "dark" ? "theme-dark" : ""}`}
      style={hydrated ? undefined : { opacity: 0 }}
    >
      {/* Keyboard shortcuts dialog */}
      <ShortcutsModal />

      {/* Mobile Drawer Backdrop */}
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
        className={`sidebar ${!isMobile && !sidebarOpen ? "is-collapsed" : ""} ${
          mobileSidebarOpen ? "mobile-open" : ""
        } ${mobileSearchOpen ? "mobile-search-open" : ""}`}
        aria-label="Chat navigation"
      >
        {/* Sidebar Brand & Top Action Row */}
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
            <span className="brand-symbol-circle">
              <TiwatLogo size={28} />
            </span>
            <span>TIWAT</span>
          </a>

          <div className="flex items-center gap-1">
            <button type="button" className="mobile-drawer-search" aria-label="Search conversations" onClick={() => { setMobileSearchOpen(true); window.setTimeout(() => document.getElementById("sidebar-search")?.focus(), 50); }}>
              <Search size={20} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                if (isMobile) {
                  setMobileSidebarOpen(false);
                } else {
                  setSidebarOpen(false);
                }
              }}
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        </div>

        {/* Sidebar Top Shortcuts */}
        <div className="sidebar-actions">
          <button type="button" className="sidebar-nav-item" onClick={startNewChat}>
            <Plus size={17} />
            <span>New chat</span>
          </button>
        </div>

        {/* Chat search */}
        <div className="sidebar-search">
          <Search size={14} aria-hidden="true" />
          <input
            id="sidebar-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
          {search ? (
            <button
              type="button"
              className="sidebar-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="kbd-hint">⌘K</kbd>
          )}
        </div>

        <div className="mobile-drawer-nav" aria-label="Workspace navigation">
          <button type="button" className="mobile-drawer-nav-item" onClick={startNewChat}><PenLine size={21} /><span>New chat</span></button>
          <button type="button" className="mobile-drawer-nav-item" onClick={() => { setMobileSearchOpen(true); window.setTimeout(() => document.getElementById("sidebar-search")?.focus(), 50); }}><Search size={21} /><span>Search conversations</span></button>
          <button type="button" className="mobile-drawer-nav-item" onClick={() => { setShortcutsModalOpen(true); setMobileSidebarOpen(false); }}><Command size={21} /><span>Keyboard shortcuts</span></button>
          <Link href="/settings" className="mobile-drawer-nav-item" onClick={() => setMobileSidebarOpen(false)}><Settings size={21} /><span>Settings</span></Link>
          <Link href="/privacy" className="mobile-drawer-nav-item" onClick={() => setMobileSidebarOpen(false)}><ShieldCheck size={21} /><span>Privacy & security</span></Link>
        </div>
        <div className="mobile-recent-heading">Recents</div>
        {/* Date-Grouped History Section */}
        <section className="history-section" aria-label="Conversation history">
          <div className="chat-list">
            {groupedChats.length ? (
              groupedChats.map(([groupName, groupList]) => (
                <div key={groupName} className="mb-3">
                  <div className="history-heading">{groupName}</div>
                  {groupList.map((chat) => (
                    <div
                      className={`chat-history-row group ${activeId === chat.id ? "active" : ""}`}
                      key={chat.id}
                    >
                      {editingChatId === chat.id ? (
                        <div className="flex items-center w-full px-2 gap-1 py-1">
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
                            <span>{chat.title}</span>
                          </button>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center pr-2 transition-opacity">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button
                                  type="button"
                                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text)] rounded"
                                  aria-label="Chat options"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  align="end"
                                  sideOffset={5}
                                  className="dropdown-content"
                                >
                                  <DropdownMenu.Item
                                    className="dropdown-item"
                                    onSelect={() => startRename(chat)}
                                  >
                                    <Pencil size={14} />
                                    <span>Rename</span>
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    className="dropdown-item text-red-500 hover:text-red-600"
                                    onSelect={() => deleteChat(chat.id)}
                                  >
                                    <Trash2 size={14} />
                                    <span>Delete</span>
                                  </DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
                {search ? "No matching conversations" : "Your chats will appear here"}
              </div>
            )}
          </div>
        </section>

        {/* User Account Footer */}
        <div className="sidebar-footer">
          <button type="button" className="user-avatar-circle" onClick={openSettings} aria-label="Open account settings" title="Account settings">
            {firebaseUser?.photoURL ? <Image src={firebaseUser.photoURL} alt="" width={48} height={48} unoptimized /> : guestMode ? "G" : (firebaseUser?.displayName || firebaseUser?.email || "T").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
          </button>
          <div className="sidebar-footer-text">
            <strong>{guestMode ? "Guest session" : firebaseUser?.displayName || firebaseUser?.email?.split("@")[0] || "My account"}</strong>
            <span>{guestMode ? "Guest workspace" : firebaseUser?.email || currentModel.name}</span>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="icon-button"
                aria-label="User settings & preferences"
              >
                <MoreHorizontal size={17} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" side="top" sideOffset={8} className="dropdown-content">
                <DropdownMenu.Item
                  className="dropdown-item"
                  onSelect={openSettings}
                >
                  <Settings size={15} />
                  <span>Settings</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-item"
                  onSelect={() => setShortcutsModalOpen(true)}
                >
                  <Command size={15} />
                  <span>Keyboard shortcuts</span>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="dropdown-separator" />
                <DropdownMenu.Item className="dropdown-item" onSelect={toggleAppearance}>
                  {appearance === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{appearance === "dark" ? "Light mode" : "Dark mode"}</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" onSelect={exportChatMarkdown}>
                  <FileCode size={15} />
                  <span>Export as Markdown</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" onSelect={exportChatJSON}>
                  <FileJson size={15} />
                  <span>Export as JSON</span>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="dropdown-separator" />
                {guestMode ? (
                  <DropdownMenu.Item
                    className="dropdown-item"
                    onSelect={() => {
                      window.location.href = "/login";
                    }}
                  >
                    <LogIn size={15} />
                    <span>Sign in to save chats</span>
                  </DropdownMenu.Item>
                ) : (
                  <DropdownMenu.Item
                    className="dropdown-item text-red-500"
                    onSelect={() => {
                      void signOut(getFirebaseAuth()).finally(() => {
                        window.location.href = "/login";
                      });
                    }}
                  >
                    <LogOut size={15} />
                    <span>Log out</span>
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item className="dropdown-item text-red-500" onSelect={clearHistory}>
                  <Trash2 size={15} />
                  <span>Clear all chats</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <div className="mobile-drawer-bottom">
          <button type="button" className="mobile-chat-button" onClick={startNewChat}><PenLine size={18} /><span>Chat</span></button>
          <button type="button" className="mobile-profile-button" onClick={openSettings} aria-label="Open account settings">
            {firebaseUser?.photoURL ? <Image src={firebaseUser.photoURL} alt="" width={48} height={48} unoptimized /> : <span>{guestMode ? "G" : (firebaseUser?.displayName || firebaseUser?.email || "T").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>}
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-panel">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            {/* Sidebar Expand Button (when collapsed or on mobile) */}
            {(!sidebarOpen || isMobile) && (
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  if (isMobile) {
                    setMobileSidebarOpen(true);
                  } else {
                    setSidebarOpen(true);
                  }
                }}
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-label="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            )}

            {/* Model Selector Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="model-picker-btn"
                  aria-label="Select model"
                >
                  <span>{currentModel.name}</span>
                  <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={6}
                  className="dropdown-content w-64"
                >
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Model
                  </div>
                  {availableModels.map((m) => (
                    <DropdownMenu.Item
                      key={m.id}
                      className="dropdown-item flex items-center justify-between"
                      onSelect={() => selectModel(m)}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs flex items-center gap-1.5">
                          <span>{m.name}</span>
                          <span className="text-[10px] px-1 py-0.2 bg-[var(--surface-soft)] rounded text-[var(--text-secondary)] font-normal">
                            {m.badge}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-tertiary)] leading-tight mt-0.5 truncate">
                          {m.description}
                        </div>
                      </div>
                      {selectedModelId === m.id && (
                        <Check size={14} className="text-[var(--accent)] shrink-0" />
                      )}
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Separator className="dropdown-separator" />
                  <DropdownMenu.Item
                    className="dropdown-item text-xs"
                    onSelect={openSettings}
                  >
                    <Settings size={14} />
                    <span>More model settings…</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <button
              type="button"
              className="icon-button"
              onClick={startNewChat}
              title="New chat"
              aria-label="New chat"
            >
              <PenLine size={20} />
            </button>
          </div>

          <div className="topbar-right">
            {/* Theme Toggle */}
            <button
              type="button"
              className="icon-button"
              onClick={toggleAppearance}
              title={appearance === "dark" ? "Light mode" : "Dark mode"}
              aria-label="Toggle color theme"
            >
              {appearance === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Settings Trigger */}
            <button
              type="button"
              className="icon-button"
              onClick={openSettings}
              title="Settings"
              aria-label="Open settings"
            >
              <Settings size={17} />
            </button>

            {/* Auth status button */}
            {guestMode ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/login";
                }}
                className="hidden sm:inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--text)] text-[var(--page)] hover:opacity-90 transition-opacity"
              >
                Sign in
              </button>
            ) : (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-full bg-[var(--text)] text-[var(--page)] flex items-center justify-center text-xs font-semibold ml-1 cursor-pointer"
                    aria-label="User profile"
                  >
                    T
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={6} className="dropdown-content">
                    <DropdownMenu.Item
                      className="dropdown-item"
                      onSelect={openSettings}
                    >
                      <Settings size={14} />
                      <span>Settings</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="dropdown-separator" />
                    <DropdownMenu.Item
                      className="dropdown-item text-red-500"
                      onSelect={() => {
                        void signOut(getFirebaseAuth()).finally(() => {
                          window.location.href = "/login";
                        });
                      }}
                    >
                      <LogOut size={14} />
                      <span>Sign out</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </header>

        {/* Scrollable Center Canvas */}
        <div className="main-scroll-frame">
        <div
          className="main-scroll"
          key={activeChat?.id || "empty"}
          ref={scrollRef}
          onScroll={handleScroll}
        >
          {!activeChat || messages.length === 0 ? (
            /* Iconic Empty State: Centered Greeting & Central Floating Input */
            <div className="welcome-container">
              <h1 className="welcome-title-chatgpt">What are we working on?</h1>
              <p className="welcome-sub">
                Ask in English or Hinglish. Attach a file or turn on web search when you need it.
              </p>

              {/* Central Floating Composer */}
              <form
                className={`composer-card-chatgpt mb-4 ${
                  isDragOver ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : ""
                }`}
                onSubmit={handleFormSubmit}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {attachment && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-lg bg-[var(--surface-soft)] text-xs text-[var(--text-secondary)] border border-[var(--line)]">
                    <FileText size={13} />
                    <span className="truncate max-w-[200px]">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-0.5 hover:text-[var(--text)]"
                      aria-label="Remove attachment"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                <textarea
                  {...form.register("message")}
                  ref={(el) => {
                    form.register("message").ref(el);
                    centerComposerRef.current = el;
                  }}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Message TIWAT"
                  aria-label="Message TIWAT"
                  autoComplete="off"
                />

                <div className="composer-toolbar-chatgpt">
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.log,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.css,.py,.sql,.sh,text/*"
                      onChange={addAttachment}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach file"
                      aria-label="Attach file"
                    >
                      <Plus size={20} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                        onClick={() => {
                          toast.info("Live web search is not connected. No web results will be fetched.");
                        }}
                        title="Live web search is not connected"
                        aria-label="Live web search is not connected"
                    >
                      <Globe size={17} />
                    </button>
                    <button
                      type="button"
                      className={`icon-button ${detailedStyleEnabled ? "text-[var(--accent)] font-semibold" : ""}`}
                        onClick={() => {
                          setDetailedStyleEnabled(!detailedStyleEnabled);
                          toast.info(detailedStyleEnabled ? "Saved response style restored" : "Detailed response style enabled");
                        }}
                        title="Detailed response style"
                        aria-label="Detailed response style"
                    >
                      <Lightbulb size={17} />
                    </button>
                  </div>

                  <div className="flex items-center">
                    <button
                      type="submit"
                      disabled={!draft.trim() && !attachment}
                      className="send-button-circle"
                      aria-label="Send message"
                    >
                      <ArrowUp size={16} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              </form>

              {/* Suggestion Chips Below Center Input */}
              <div className="welcome-prompt-grid">
                {promptSuggestions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.title}
                      className="welcome-prompt-card"
                      onClick={() => choosePrompt(item.prompt)}
                    >
                      <span className="prompt-icon">
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[var(--text)]">{item.title}</div>
                        <div className="text-[11px] text-[var(--text-tertiary)] truncate">{item.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Conversation View */
            <div className="conversation-wrap" aria-live="polite" ref={contentRef}>
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  >
                    {message.role === "user" ? (
                      /* User Message: Clean right-aligned pill bubble */
                      <div className="message-row-user group">
                        <div className="flex flex-col items-end">
                          <div className="user-bubble-chatgpt">{message.content}</div>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 mt-1.5 mr-2 text-[11px] text-[var(--text-tertiary)] transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleEditMessage(message.content)}
                              className="hover:text-[var(--text)] flex items-center gap-1"
                              title="Edit prompt"
                            >
                              <Pencil size={11} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyText(message.id, message.content)}
                              className="hover:text-[var(--text)] flex items-center gap-1"
                              title="Copy prompt"
                            >
                              {copiedId === message.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedId === message.id ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Assistant Message: Left-aligned directly on canvas with TIWAT logo badge */
                      <div className="message-row-assistant">
                        <div className="assistant-avatar-badge" title="TIWAT">
                          <TiwatLogo size={28} />
                        </div>

                        <div className="assistant-body">
                          {message.content ? (
                            message.id === animatedMessageId ? (
                              <TypewriterMarkdown
                                content={message.content}
                                isStreaming={isGenerating}
                                onComplete={() => setAnimatedMessageId((id) => (id === message.id ? null : id))}
                              />
                            ) : (
                              <div className="markdown-body">
                                <MarkdownContent content={message.content} />
                              </div>
                            )
                          ) : (
                            /* Thinking / Streaming pulse */
                            <div className="flex items-center gap-1.5 py-2" role="status" aria-label="Thinking">
                              <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-pulse" />
                              <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-pulse delay-150" />
                              <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-pulse delay-300" />
                            </div>
                          )}

                          {/* Assistant Action Bar */}
                          {message.content && (
                            <div className="message-actions-bar">
                              <button
                                type="button"
                                className="message-action-btn"
                                onClick={() => void copyText(message.id, message.content)}
                                title="Copy response"
                              >
                                {copiedId === message.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                              </button>
                              <button
                                type="button"
                                className={`message-action-btn ${thumbsState[message.id] === "up" ? "text-emerald-500" : ""}`}
                                onClick={() => handleFeedback(message.id, "up")}
                                title="Good response"
                              >
                                <ThumbsUp size={13} />
                              </button>
                              <button
                                type="button"
                                className={`message-action-btn ${thumbsState[message.id] === "down" ? "text-red-500" : ""}`}
                                onClick={() => handleFeedback(message.id, "down")}
                                title="Bad response"
                              >
                                <ThumbsDown size={13} />
                              </button>
                              <button
                                type="button"
                                className="message-action-btn"
                                onClick={() => handleRegenerate(message.id)}
                                disabled={isGenerating}
                                title="Regenerate"
                              >
                                <RotateCcw size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
        {hasMessages && showJumpToLatest && (
          <button type="button" className="scroll-jump" onClick={jumpToLatest} aria-label="Jump to latest message">
            <ArrowDown size={15} />
            <span>Latest</span>
          </button>
        )}
        </div>

        {/* Sticky Bottom Composer (Active when messages exist) */}
        {activeChat && messages.length > 0 && (
          <div className="composer-zone-chatgpt">
            <form
              className={`composer-card-chatgpt ${
                isDragOver ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : ""
              }`}
              onSubmit={handleFormSubmit}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {attachment && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-1.5 rounded-lg bg-[var(--surface-soft)] text-xs text-[var(--text-secondary)] border border-[var(--line)]">
                  <FileText size={13} />
                  <span className="truncate max-w-[200px]">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="p-0.5 hover:text-[var(--text)]"
                    aria-label="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <textarea
                {...form.register("message")}
                ref={(el) => {
                  form.register("message").ref(el);
                  composerRef.current = el;
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Message TIWAT"
                aria-label="Message TIWAT"
                autoComplete="off"
              />

              <div className="composer-toolbar-chatgpt">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.log,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.css,.py,.sql,.sh,text/*"
                    onChange={addAttachment}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                    aria-label="Attach file"
                  >
                    <Plus size={20} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                        onClick={() => {
                          toast.info("Live web search is not connected. No web results will be fetched.");
                        }}
                        title="Live web search is not connected"
                        aria-label="Live web search is not connected"
                  >
                    <Globe size={17} />
                  </button>
                  <button
                    type="button"
                    className={`icon-button ${detailedStyleEnabled ? "text-[var(--accent)] font-semibold" : ""}`}
                        onClick={() => {
                          setDetailedStyleEnabled(!detailedStyleEnabled);
                          toast.info(detailedStyleEnabled ? "Saved response style restored" : "Detailed response style enabled");
                        }}
                        title="Detailed response style"
                        aria-label="Detailed response style"
                  >
                    <Lightbulb size={17} />
                  </button>
                </div>

                <div className="flex items-center">
                  {isGenerating ? (
                    <button
                      type="button"
                      className="send-button-circle stop-btn"
                      onClick={stopGeneration}
                      title="Stop generating"
                      aria-label="Stop generating"
                    >
                      <Square size={13} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!draft.trim() && !attachment}
                      className="send-button-circle"
                      title="Send message"
                      aria-label="Send message"
                    >
                      <ArrowUp size={16} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </div>
            </form>
            <div className="disclaimer-chatgpt">
              TIWAT can make mistakes. Check important info.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

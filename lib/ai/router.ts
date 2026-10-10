import type { ConversationMessage } from "@/lib/ai/schema";

type Provider = "openai" | "groq" | "anthropic" | "gemini";
type ChatResult = { message: string };
const SYSTEM_PROMPT = "You are Axiom, an exceptionally helpful AI assistant. Be accurate, thoughtful, and direct. Match the user's language, including natural Hinglish when appropriate. Use concise structure and Markdown when useful. For complex work, reason carefully before responding, but do not reveal private chain-of-thought. Be transparent about uncertainty and never invent facts or claim tools were used when they were not.";

function keyFor(provider: Provider): string | undefined {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "groq") return process.env.GROQ_API_KEY;
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY;
  return process.env.GEMINI_API_KEY;
}

function modelFor(provider: Provider): string {
  if (provider === "openai") return process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (provider === "groq") return process.env.GROQ_MODEL || process.env.DEFAULT_MODEL || "openai/gpt-oss-120b";
  if (provider === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  return process.env.GEMINI_MODEL || "gemini-3.8-flash";
}

function rankedProviders(messages: ConversationMessage[]): Provider[] {
  const prompt = messages.slice(-4).map((message) => message.content).join(" ").toLowerCase();
  const technical = /\b(code|coding|debug|typescript|javascript|python|sql|stack trace|refactor|algorithm|architecture|reasoning|prove|proof|math|analy[sz]e|analy[sz]is|complex|logic|technical|system design)\b/.test(prompt);
  const creative = /\b(story|creative|brand voice|marketing copy|poem|script|chapter|writing style|fiction|tagline|campaign)\b/.test(prompt);
  const multilingual = /[\u0900-\u097f]/.test(prompt) || /\b(translate|translation|multilingual|hindi|hinglish|language)\b/.test(prompt);
  const ranking: Provider[] = technical
    ? ["openai", "anthropic", "gemini", "groq"]
    : creative
      ? ["anthropic", "openai", "gemini", "groq"]
      : multilingual
        ? ["gemini", "groq", "openai", "anthropic"]
        : ["groq", "openai", "gemini", "anthropic"];
  return ranking.filter((provider, index) => ranking.indexOf(provider) === index && Boolean(keyFor(provider)));
}

async function requestOpenAICompatible(provider: "openai" | "groq", key: string, messages: ConversationMessage[]): Promise<ChatResult> {
  const endpoint = provider === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelFor(provider),
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages.slice(-32)],
      max_completion_tokens: 4096,
      temperature: 0.6,
    }),
  });
  if (!response.ok) throw new Error("Provider " + provider + " returned status " + response.status);
  const data: unknown = await response.json();
  const content = (data as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> })?.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((part) => part.text || "").join("") : content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Provider " + provider + " returned an empty response");
  return { message: text.trim() };
}

async function requestAnthropic(key: string, messages: ConversationMessage[]): Promise<ChatResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: modelFor("anthropic"),
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-32).map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content })),
    }),
  });
  if (!response.ok) throw new Error("Provider anthropic returned status " + response.status);
  const data: unknown = await response.json();
  const blocks = (data as { content?: Array<{ type?: string; text?: string }> }).content || [];
  const text = blocks.filter((block) => block.type === "text").map((block) => block.text || "").join("").trim();
  if (!text) throw new Error("Provider anthropic returned an empty response");
  return { message: text };
}

async function requestGemini(key: string, messages: ConversationMessage[]): Promise<ChatResult> {
  const model = modelFor("gemini");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: messages.slice(-32).map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
      generationConfig: { maxOutputTokens: 4096, temperature: 0.6 },
    }),
  });
  if (!response.ok) throw new Error("Provider gemini returned status " + response.status);
  const data: unknown = await response.json();
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || "").join("").trim();
  if (!text) throw new Error("Provider gemini returned an empty response");
  return { message: text };
}

async function callProvider(provider: Provider, messages: ConversationMessage[]): Promise<ChatResult> {
  const key = keyFor(provider);
  if (!key) throw new Error("Provider is not configured");
  if (provider === "openai" || provider === "groq") return requestOpenAICompatible(provider, key, messages);
  if (provider === "anthropic") return requestAnthropic(key, messages);
  return requestGemini(key, messages);
}

export async function createAIResponse(messages: ConversationMessage[]): Promise<ChatResult> {
  const providers = rankedProviders(messages);
  if (!providers.length) throw new Error("NO_PROVIDER_CONFIGURED");
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await callProvider(provider, messages);
    } catch (error) {
      lastError = error;
      const reason = error instanceof Error ? error.message : "unknown provider error";
      console.error("Axiom provider request failed", { provider, reason });
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ALL_PROVIDERS_FAILED");
}

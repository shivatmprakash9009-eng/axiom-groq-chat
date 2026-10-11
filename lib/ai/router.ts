import { AllProvidersFailedError, NoProviderConfiguredError } from "./errors";
import { getAnthropicKey, getAnthropicModel, requestAnthropic, streamAnthropic } from "./providers/anthropic";
import { getGeminiKey, getGeminiModel, requestGemini, streamGemini } from "./providers/gemini";
import { getGroqKey, getGroqModel, requestGroq, streamGroq } from "./providers/groq";
import { getOpenAIKey, getOpenAIModel, requestOpenAI, streamOpenAI } from "./providers/openai";
import type { ChatOptions, ChatResult, ConversationMessage, ProviderName, ProviderStatus, StreamChunk } from "./types";

export const BASE_SYSTEM_PROMPT =
  "You are Axiom, an exceptionally helpful AI assistant. Be accurate, thoughtful, and direct. Match the user's language, including natural Hinglish when appropriate. Use concise structure and Markdown when useful. For complex work, reason carefully before responding, but do not reveal private chain-of-thought. Be transparent about uncertainty and never invent facts or claim tools were used when they were not.";

export function buildSystemPrompt(options?: ChatOptions): string {
  let prompt = options?.customSystemPrompt?.trim() || BASE_SYSTEM_PROMPT;

  if (options?.style === "concise") {
    prompt += "\n\nStyle requirement: Keep answers clear, minimal, and direct. Omit boilerplate or filler words.";
  } else if (options?.style === "detailed") {
    prompt += "\n\nStyle requirement: Provide comprehensive explanations, structured sections, edge cases, and in-depth analysis.";
  } else if (options?.style === "code") {
    prompt += "\n\nStyle requirement: Prioritize production-ready code with TypeScript types, error handling, clean design patterns, and concise explanations.";
  }

  return prompt;
}

export function keyFor(provider: ProviderName): string | undefined {
  if (provider === "gemini") return getGeminiKey();
  if (provider === "groq") return getGroqKey();
  if (provider === "openai") return getOpenAIKey();
  if (provider === "anthropic") return getAnthropicKey();
  return undefined;
}

export function modelFor(provider: ProviderName): string {
  if (provider === "gemini") return getGeminiModel();
  if (provider === "groq") return getGroqModel();
  if (provider === "openai") return getOpenAIModel();
  if (provider === "anthropic") return getAnthropicModel();
  return "default";
}

export function getConfiguredProviders(): ProviderStatus[] {
  const providers: ProviderName[] = ["gemini", "groq", "openai", "anthropic"];
  return providers.map((name, index) => ({
    name,
    configured: Boolean(keyFor(name)),
    model: modelFor(name),
    priority: index + 1,
  }));
}

export function rankedProviders(messages: ConversationMessage[]): ProviderName[] {
  const prompt = messages
    .slice(-4)
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  const technical =
    /\b(code|coding|debug|typescript|javascript|python|sql|stack trace|refactor|algorithm|architecture|reasoning|prove|proof|math|analy[sz]e|analy[sz]is|complex|logic|technical|system design)\b/.test(
      prompt
    );
  const creative =
    /\b(story|creative|brand voice|marketing copy|poem|script|chapter|writing style|fiction|tagline|campaign)\b/.test(
      prompt
    );
  const multilingual =
    /[\u0900-\u097f]/.test(prompt) ||
    /\b(translate|translation|multilingual|hindi|hinglish|language)\b/.test(prompt);

  const baseRanking: ProviderName[] = technical
    ? ["openai", "anthropic", "gemini", "groq"]
    : creative
      ? ["anthropic", "openai", "gemini", "groq"]
      : multilingual
        ? ["gemini", "groq", "openai", "anthropic"]
        : ["gemini", "groq", "openai", "anthropic"];

  return baseRanking.filter((provider, index) => baseRanking.indexOf(provider) === index && Boolean(keyFor(provider)));
}

async function callProvider(
  provider: ProviderName,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): Promise<ChatResult> {
  const key = keyFor(provider);
  if (!key) throw new Error(`Provider ${provider} is not configured`);

  if (provider === "gemini") {
    return requestGemini(key, messages, systemPrompt, options);
  }
  if (provider === "groq") {
    return requestGroq(key, messages, systemPrompt, options);
  }
  if (provider === "openai") {
    return requestOpenAI(key, messages, systemPrompt, options);
  }
  return requestAnthropic(key, messages, systemPrompt, options);
}

export async function createAIResponse(
  messages: ConversationMessage[],
  options?: ChatOptions
): Promise<ChatResult> {
  const providers = rankedProviders(messages);
  if (!providers.length) {
    throw new NoProviderConfiguredError();
  }

  const systemPrompt = buildSystemPrompt(options);
  const correlationId =
    options?.correlationId ||
    (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()));
  const failures: Array<{ provider: ProviderName; error: string }> = [];

  for (const provider of providers) {
    try {
      const result = await callProvider(provider, messages, systemPrompt, options);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[Axiom ${correlationId}] Provider ${provider} failed: ${reason}`);
      failures.push({ provider, error: reason });
      // Once bytes have been emitted, switching providers would mix two answers.
      // Fail the stream instead; fallback is safe only before the first chunk.
      if (yieldedAny) {
        throw error;
      }
    }
  }

  throw new AllProvidersFailedError(failures);
}

export async function* createAIStream(
  messages: ConversationMessage[],
  options?: ChatOptions
): AsyncGenerator<StreamChunk, void, unknown> {
  const providers = rankedProviders(messages);
  if (!providers.length) {
    throw new NoProviderConfiguredError();
  }

  const systemPrompt = buildSystemPrompt(options);
  const correlationId =
    options?.correlationId ||
    (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()));
  const failures: Array<{ provider: ProviderName; error: string }> = [];

  for (const provider of providers) {
    const key = keyFor(provider);
    if (!key) continue;

    let yieldedAny = false;
    try {
      let streamGen: AsyncGenerator<StreamChunk, void, unknown>;

      if (provider === "gemini") {
        streamGen = streamGemini(key, messages, systemPrompt, options);
      } else if (provider === "groq") {
        streamGen = streamGroq(key, messages, systemPrompt, options);
      } else if (provider === "openai") {
        streamGen = streamOpenAI(key, messages, systemPrompt, options);
      } else {
        streamGen = streamAnthropic(key, messages, systemPrompt, options);
      }

      for await (const chunk of streamGen) {
        yieldedAny = true;
        yield chunk;
      }

      if (yieldedAny) {
        return;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[Axiom ${correlationId}] Stream provider ${provider} failed: ${reason}`);
      failures.push({ provider, error: reason });
    }
  }

  throw new AllProvidersFailedError(failures);
}

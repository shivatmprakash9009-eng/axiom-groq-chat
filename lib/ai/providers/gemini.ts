import {
  ProviderAuthError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../errors";
import type { ChatOptions, ChatResult, ConversationMessage, StreamChunk } from "../types";

export function getGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function parseGeminiError(status: number, body: string, provider = "gemini" as const): never {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message = parsed.error?.message || body;
  } catch {
    // raw string
  }

  if (status === 401 || status === 403 || message.includes("API key not valid") || message.includes("API_KEY_INVALID")) {
    throw new ProviderAuthError(provider, message);
  }
  if (status === 429 || message.includes("RESOURCE_EXHAUSTED")) {
    throw new ProviderRateLimitError(provider, undefined, message);
  }
  if (status === 503 || status === 500 || status === 504 || message.includes("UNAVAILABLE") || message.includes("high demand")) {
    throw new ProviderUnavailableError(provider, message);
  }
  if (status === 400) {
    throw new ProviderInvalidRequestError(provider, message);
  }
  throw new Error(`Provider gemini returned status ${status}: ${message}`);
}

function formatContents(messages: ConversationMessage[]) {
  return messages.slice(-32).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export async function requestGemini(
  key: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): Promise<ChatResult> {
  const primaryModel = getGeminiModel();
  const modelsToTry = [primaryModel];
  if (primaryModel !== "gemini-2.5-flash") {
    modelsToTry.push("gemini-2.5-flash");
  }

  let lastError: unknown;

  for (const model of modelsToTry) {
    const startTime = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        signal: options?.signal || AbortSignal.timeout(60_000),
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: formatContents(messages),
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: options?.temperature ?? 0.6,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        parseGeminiError(response.status, errorText);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p: { text?: string }) => p.text || "").join("").trim();
      if (!text) {
        throw new Error("Provider gemini returned an empty response");
      }

      const latencyMs = Date.now() - startTime;
      const usageMetadata = data.usageMetadata;

      return {
        message: text,
        provider: "gemini",
        model,
        latencyMs,
        usage: {
          promptTokens: usageMetadata?.promptTokenCount,
          completionTokens: usageMetadata?.candidatesTokenCount,
          totalTokens: usageMetadata?.totalTokenCount,
        },
      };
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new ProviderTimeoutError("gemini", 60_000, err);
      }
      // If error is 503/unavailable and we have a fallback model, continue loop
      if (err instanceof ProviderUnavailableError && model !== "gemini-2.5-flash") {
        console.warn(`[Axiom] Gemini ${model} unavailable, attempting fallback to gemini-2.5-flash`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export async function* streamGemini(
  key: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): AsyncGenerator<StreamChunk, void, unknown> {
  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    signal: options?.signal || AbortSignal.timeout(60_000),
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: formatContents(messages),
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: options?.temperature ?? 0.6,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    parseGeminiError(response.status, errorText);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Gemini stream body is null");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const data = JSON.parse(jsonStr);
            const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textPart) {
              yield {
                text: textPart,
                done: false,
                provider: "gemini",
                model,
              };
            }
          } catch {
            // partial chunk
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { text: "", done: true, provider: "gemini", model };
}

import {
  ProviderAuthError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../errors";
import type { ChatOptions, ChatResult, ConversationMessage, StreamChunk } from "../types";

export function getGroqKey(): string | undefined {
  return process.env.GROQ_API_KEY?.trim() || undefined;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || process.env.DEFAULT_MODEL?.trim() || "llama-3.3-70b-versatile";
}

function parseGroqError(status: number, body: string): never {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message = parsed.error?.message || body;
  } catch {
    // raw string
  }

  if (status === 401 || status === 403) {
    throw new ProviderAuthError("groq", message);
  }
  if (status === 429) {
    throw new ProviderRateLimitError("groq", undefined, message);
  }
  if (status === 503 || status === 500 || status === 502) {
    throw new ProviderUnavailableError("groq", message);
  }
  if (status === 400) {
    throw new ProviderInvalidRequestError("groq", message);
  }
  throw new Error(`Provider groq returned status ${status}: ${message}`);
}

export async function requestGroq(
  key: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): Promise<ChatResult> {
  const model = getGroqModel();
  const startTime = Date.now();

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      cache: "no-store",
      signal: options?.signal || AbortSignal.timeout(60_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-32)],
        temperature: options?.temperature ?? 0.6,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      parseGroqError(response.status, errorText);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.map((part: { text?: string }) => part.text || "").join("")
      : content;

    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Provider groq returned an empty response");
    }

    const latencyMs = Date.now() - startTime;
    return {
      message: text.trim(),
      provider: "groq",
      model,
      latencyMs,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ProviderTimeoutError("groq", 60_000, err);
    }
    throw err;
  }
}

export async function* streamGroq(
  key: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): AsyncGenerator<StreamChunk, void, unknown> {
  const model = getGroqModel();

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    cache: "no-store",
    signal: options?.signal || AbortSignal.timeout(60_000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-32)],
      temperature: options?.temperature ?? 0.6,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    parseGroqError(response.status, errorText);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Groq stream body is null");
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
          if (jsonStr === "[DONE]") {
            yield { text: "", done: true, provider: "groq", model };
            return;
          }
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              yield { text: delta, done: false, provider: "groq", model };
            }
          } catch {
            // chunk fragment
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { text: "", done: true, provider: "groq", model };
}

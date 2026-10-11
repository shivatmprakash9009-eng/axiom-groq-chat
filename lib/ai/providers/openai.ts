import {
  ProviderAuthError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../errors";
import type { ChatOptions, ChatResult, ConversationMessage, StreamChunk } from "../types";

export function getOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function parseOpenAIError(status: number, body: string): never {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message = parsed.error?.message || body;
  } catch {
    // raw
  }

  if (status === 401 || status === 403) {
    throw new ProviderAuthError("openai", message);
  }
  if (status === 429) {
    throw new ProviderRateLimitError("openai", undefined, message);
  }
  if (status === 503 || status === 500) {
    throw new ProviderUnavailableError("openai", message);
  }
  if (status === 400) {
    throw new ProviderInvalidRequestError("openai", message);
  }
  throw new Error(`Provider openai returned status ${status}: ${message}`);
}

export async function requestOpenAI(
  key: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): Promise<ChatResult> {
  const model = getOpenAIModel();
  const startTime = Date.now();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
      parseOpenAIError(response.status, errorText);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.map((part: { text?: string }) => part.text || "").join("")
      : content;

    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Provider openai returned an empty response");
    }

    const latencyMs = Date.now() - startTime;
    return {
      message: text.trim(),
      provider: "openai",
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
      throw new ProviderTimeoutError("openai", 60_000, err);
    }
    throw err;
  }
}

export async function* streamOpenAI(
  key: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): AsyncGenerator<StreamChunk, void, unknown> {
  const model = getOpenAIModel();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    parseOpenAIError(response.status, errorText);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("OpenAI stream body is null");

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
            yield { text: "", done: true, provider: "openai", model };
            return;
          }
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              yield { text: delta, done: false, provider: "openai", model };
            }
          } catch {
            // fragment
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { text: "", done: true, provider: "openai", model };
}

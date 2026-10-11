import {
  ProviderAuthError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../errors";
import type { ChatOptions, ChatResult, ConversationMessage, StreamChunk } from "../types";

export function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-latest";
}

function parseAnthropicError(status: number, body: string): never {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message = parsed.error?.message || body;
  } catch {
    // raw
  }

  if (status === 401 || status === 403) {
    throw new ProviderAuthError("anthropic", message);
  }
  if (status === 429) {
    throw new ProviderRateLimitError("anthropic", undefined, message);
  }
  if (status === 503 || status === 500 || status === 529) {
    throw new ProviderUnavailableError("anthropic", message);
  }
  if (status === 400) {
    throw new ProviderInvalidRequestError("anthropic", message);
  }
  throw new Error(`Provider anthropic returned status ${status}: ${message}`);
}

export async function requestAnthropic(
  key: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): Promise<ChatResult> {
  const model = getAnthropicModel();
  const startTime = Date.now();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      cache: "no-store",
      signal: options?.signal || AbortSignal.timeout(60_000),
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.slice(-32).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.6,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      parseAnthropicError(response.status, errorText);
    }

    const data = await response.json();
    const blocks = data.content || [];
    const text = blocks
      .filter((b: { type?: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text || "")
      .join("")
      .trim();

    if (!text) {
      throw new Error("Provider anthropic returned an empty response");
    }

    const latencyMs = Date.now() - startTime;
    return {
      message: text,
      provider: "anthropic",
      model,
      latencyMs,
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ProviderTimeoutError("anthropic", 60_000, err);
    }
    throw err;
  }
}

export async function* streamAnthropic(
  key: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  options?: ChatOptions
): AsyncGenerator<StreamChunk, void, unknown> {
  const model = getAnthropicModel();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    cache: "no-store",
    signal: options?.signal || AbortSignal.timeout(60_000),
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.slice(-32).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.6,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    parseAnthropicError(response.status, errorText);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Anthropic stream body is null");

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
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === "content_block_delta" && data.delta?.text) {
              yield { text: data.delta.text, done: false, provider: "anthropic", model };
            } else if (data.type === "message_stop") {
              yield { text: "", done: true, provider: "anthropic", model };
              return;
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

  yield { text: "", done: true, provider: "anthropic", model };
}

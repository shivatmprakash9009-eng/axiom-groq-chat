import assert from "node:assert";
import test from "node:test";
import { ProviderAuthError, ProviderRateLimitError, ProviderUnavailableError } from "../lib/ai/errors.ts";
import { BASE_SYSTEM_PROMPT, buildSystemPrompt, getConfiguredProviders } from "../lib/ai/router.ts";

test("buildSystemPrompt uses BASE_SYSTEM_PROMPT by default", () => {
  const prompt = buildSystemPrompt();
  assert.ok(prompt.startsWith("# IDENTITY\nYou are TIWAT"));
  assert.strictEqual(prompt, BASE_SYSTEM_PROMPT);
});

test("buildSystemPrompt appends style guidelines", () => {
  const concisePrompt = buildSystemPrompt({ style: "concise" });
  assert.ok(concisePrompt.includes("Style requirement: Keep answers clear, minimal, and direct"));

  const codePrompt = buildSystemPrompt({ style: "code" });
  assert.ok(codePrompt.includes("Style requirement: Prioritize production-ready code"));
});

test("buildSystemPrompt respects customSystemPrompt override", () => {
  const custom = "Custom instructions for TIWAT.";
  const prompt = buildSystemPrompt({ customSystemPrompt: custom });
  assert.ok(prompt.startsWith(BASE_SYSTEM_PROMPT));
  assert.ok(prompt.includes("<user_preferences>"));
  assert.ok(prompt.includes(custom));
});

test("AIError subclasses have correct status codes and retryability", () => {
  const authErr = new ProviderAuthError("openai");
  assert.strictEqual(authErr.statusCode, 401);
  assert.strictEqual(authErr.isRetryable, false);

  const rateErr = new ProviderRateLimitError("gemini", 1000);
  assert.strictEqual(rateErr.statusCode, 429);
  assert.strictEqual(rateErr.isRetryable, true);

  const unavailErr = new ProviderUnavailableError("groq");
  assert.strictEqual(unavailErr.statusCode, 503);
  assert.strictEqual(unavailErr.isRetryable, true);
});

test("getConfiguredProviders returns all 4 providers with metadata", () => {
  const statuses = getConfiguredProviders();
  assert.strictEqual(statuses.length, 4);
  const names = statuses.map((s) => s.name);
  assert.ok(names.includes("gemini"));
  assert.ok(names.includes("groq"));
  assert.ok(names.includes("openai"));
  assert.ok(names.includes("anthropic"));
});

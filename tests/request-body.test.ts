import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedTextBody } from "../lib/security/request-body.ts";

test("accepts a request body exactly at the configured byte limit", async () => {
  const request = new Request("https://example.test", { method: "POST", body: "12345" });
  const result = await readBoundedTextBody(request, 5);
  assert.deepEqual(result, { text: "12345", tooLarge: false });
});

test("rejects a body that exceeds the byte limit even when no length header is set", async () => {
  const request = new Request("https://example.test", { method: "POST", body: "123456" });
  const result = await readBoundedTextBody(request, 5);
  assert.deepEqual(result, { text: "", tooLarge: true });
});

test("rejects an oversized declared content length before consuming the body", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": "200" },
    body: "small",
  });
  const result = await readBoundedTextBody(request, 100);
  assert.deepEqual(result, { text: "", tooLarge: true });
});

test("rejects malformed UTF-8 instead of silently replacing invalid bytes", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    body: new Uint8Array([0xff, 0xfe]),
  });
  await assert.rejects(() => readBoundedTextBody(request, 10), /encoded data|UTF-8/i);
});

test("rejects invalid maximum sizes", async () => {
  const request = new Request("https://example.test", { method: "POST", body: "x" });
  await assert.rejects(() => readBoundedTextBody(request, -1), RangeError);
});

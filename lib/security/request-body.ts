export interface BoundedTextBody {
  text: string;
  tooLarge: boolean;
}

/**
 * Read a request body as UTF-8 without buffering more than maxBytes.
 * Content-Length is used as an early rejection only; the streamed byte count
 * remains authoritative because headers may be absent or inaccurate.
 */
export async function readBoundedTextBody(request: Request, maxBytes: number): Promise<BoundedTextBody> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("maxBytes must be a non-negative safe integer.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    await request.body?.cancel().catch(() => undefined);
    return { text: "", tooLarge: true };
  }

  if (!request.body) return { text: "", tooLarge: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { text: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    tooLarge: false,
  };
}

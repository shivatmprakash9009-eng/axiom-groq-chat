import type { ProviderName } from "./types";

export class AIError extends Error {
  readonly provider?: ProviderName;
  readonly statusCode?: number;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    options?: { provider?: ProviderName; statusCode?: number; isRetryable?: boolean; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "AIError";
    this.provider = options?.provider;
    this.statusCode = options?.statusCode;
    this.isRetryable = options?.isRetryable ?? false;
  }
}

export class ProviderAuthError extends AIError {
  constructor(provider: ProviderName, message = "Authentication failed. Check API key configuration.", cause?: unknown) {
    super(`Provider ${provider} authentication error: ${message}`, {
      provider,
      statusCode: 401,
      isRetryable: false,
      cause,
    });
    this.name = "ProviderAuthError";
  }
}

export class ProviderRateLimitError extends AIError {
  readonly retryAfterMs?: number;

  constructor(provider: ProviderName, retryAfterMs?: number, message = "Rate limit reached.", cause?: unknown) {
    super(`Provider ${provider} rate limited: ${message}`, {
      provider,
      statusCode: 429,
      isRetryable: true,
      cause,
    });
    this.name = "ProviderRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderQuotaError extends AIError {
  constructor(provider: ProviderName, message = "Usage quota exceeded.", cause?: unknown) {
    super(`Provider ${provider} quota exceeded: ${message}`, {
      provider,
      statusCode: 402,
      isRetryable: false,
      cause,
    });
    this.name = "ProviderQuotaError";
  }
}

export class ProviderUnavailableError extends AIError {
  constructor(provider: ProviderName, message = "Service or model is currently unavailable.", cause?: unknown) {
    super(`Provider ${provider} unavailable: ${message}`, {
      provider,
      statusCode: 503,
      isRetryable: true,
      cause,
    });
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderTimeoutError extends AIError {
  constructor(provider: ProviderName, timeoutMs: number, cause?: unknown) {
    super(`Provider ${provider} timed out after ${timeoutMs}ms`, {
      provider,
      statusCode: 504,
      isRetryable: true,
      cause,
    });
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderInvalidRequestError extends AIError {
  constructor(provider: ProviderName, message: string, cause?: unknown) {
    super(`Provider ${provider} bad request: ${message}`, {
      provider,
      statusCode: 400,
      isRetryable: false,
      cause,
    });
    this.name = "ProviderInvalidRequestError";
  }
}

export class NoProviderConfiguredError extends AIError {
  constructor() {
    super("NO_PROVIDER_CONFIGURED", {
      statusCode: 503,
      isRetryable: false,
    });
    this.name = "NoProviderConfiguredError";
  }
}

export class AllProvidersFailedError extends AIError {
  readonly failures: Array<{ provider: ProviderName; error: string }>;

  constructor(failures: Array<{ provider: ProviderName; error: string }>) {
    super("ALL_PROVIDERS_FAILED", {
      statusCode: 502,
      isRetryable: true,
    });
    this.name = "AllProvidersFailedError";
    this.failures = failures;
  }
}

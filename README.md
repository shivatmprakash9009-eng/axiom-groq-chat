# TIWAT — Autonomous Intelligent Workspace

TIWAT is a production-grade, calm, and responsive AI workspace built on Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS v4, Radix primitives, Framer Motion, TanStack Query, Zustand, Zod, and Biome.

## Highlights & Capabilities

- **Multi-Provider AI Architecture**: Server-side router orchestrating Google Gemini, Groq, OpenAI, and Anthropic Claude with automatic failover, latency measurement, and correlation ID tracking (`x-request-id`).
- **Real-Time Streaming**: Server-Sent Events (SSE) token streaming for responsive chat generation with instant stop/abort control.
- **Failover & Bounded Retries**: Gracefully falls back across eligible configured providers if a primary model experiences transient load or unavailability (e.g. Gemini 503 fallback).
- **Dual-Layer Rate Limiting**: Built-in sliding-window memory rate limiter protects the API by default; optionally enhanced by Arcjet shielding when `ARCJET_KEY` is provided.
- **Apple-Inspired Design Tokens**: Restrained, calm visual hierarchy with light/dark appearance modes and zero-pill aesthetic.
- **Conversation Management**: Search conversations with quick filtering (`⌘K`), inline renaming, individual conversation deletion, and export to Markdown (`.md`) or JSON (`.json`).
- **Code Block Rendering**: Syntax-highlighted code blocks with language labels and one-click copy buttons.
- **Customizable Workspace Settings**: Style presets (Balanced, Concise, In-depth, Code First), custom system prompt instructions, and real-time generation toggles.
- **Keyboard Shortcuts**: Complete productivity shortcuts overlay accessible via `⌘,` or composer buttons.
- **Strict Quality Gates**: Complete TypeScript type safety, Biome linting, automated unit tests, and GitHub Actions CI workflow.

## Architecture & File Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Multi-provider streaming & non-streaming chat endpoint
│   │   └── health/route.ts    # Operational health check & active provider signals
│   ├── globals.css            # Tailwind CSS v4 and brand design tokens
│   ├── layout.tsx             # Root layout with fonts, metadata, and providers
│   └── page.tsx               # Primary chat workspace interface
├── components/
│   ├── chat-workspace.tsx     # Primary chat workspace with SSE streaming and history
│   ├── code-block.tsx         # Markdown code block with copy button and language label
│   ├── settings-modal.tsx     # SaaS workspace settings and system diagnostics
│   ├── shortcuts-modal.tsx    # Keyboard shortcuts reference dialog
│   └── providers.tsx          # TanStack Query, Sonner toaster, and Nuqs adapter
├── lib/
│   ├── ai/
│   │   ├── errors.ts          # Typed, normalized AI error classes with retry metadata
│   │   ├── router.ts          # Provider ranking, failover, and streaming generator
│   │   ├── schema.ts          # Zod validation schemas for requests and composer
│   │   ├── types.ts           # Shared AI types, interfaces, and options
│   │   └── providers/         # Modular provider adapters (Gemini, Groq, OpenAI, Anthropic)
│   └── security/
│       └── rate-limiter.ts    # Sliding-window memory rate limiter
├── stores/
│   └── ui-store.ts            # Zustand store for appearance, sidebar, and preferences
└── tests/                     # Automated unit test suite (rate limiter, schemas, router)
```

## Local Development

1. **Prerequisites**: Node.js 22 or newer.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup**:
   Copy `.env.example` to `.env.local` and provide at least one provider API key:
   - `GEMINI_API_KEY` (recommended for Google AI Studio / Gemini 2.5 Flash)
   - `GROQ_API_KEY`
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Quality Gates & Verification

Run all quality checks before shipping:

```bash
# Run automated unit tests
npm test

# Check TypeScript type safety
npm run typecheck

# Run Biome linter & formatting check
npm run lint

# Build production bundle
npm run build
```

## Security & Operational Principles

- **No Client Secrets**: AI provider keys and model configurations are strictly server-side and never exposed in browser bundles or client requests.
- **Fail-Safe Operation**: When no provider keys are configured, TIWAT returns clear, non-leaking diagnostic guidance.
- **Rate Limiting**: Requests are metered at 30 requests/minute per client IP via the sliding window limiter.
- **Sanitized Inputs**: Requests are bounded to 50 messages and 150,000 characters total context size to prevent denial-of-service and memory exhaustion.

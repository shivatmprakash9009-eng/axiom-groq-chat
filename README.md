# Axiom

Axiom is a responsive AI workspace built on Next.js App Router, React 19, strict TypeScript, Tailwind CSS v4, Radix primitives, Framer Motion, TanStack Query, Zustand, Nuqs, Zod, React Hook Form, Sonner, Biome, PostHog, Arcjet, and Vercel Speed Insights.

## Architecture

- The Next.js App Router serves the interface and the server-side chat API.
- The client does not choose, display, or receive a model/provider identifier. A server-side router routes technical/reasoning, creative-writing, multilingual, and general requests to available providers.
- Supported server-side providers: OpenAI, Groq, Anthropic Claude, and Google Gemini. If a preferred provider fails, Axiom tries the next configured provider.
- Conversation history and appearance are stored in local browser storage. No login, account sync, or shared database has been added yet.
- Text, Markdown, CSV, JSON, HTML, logs, and common text-code file attachments are read in the browser and included as text context (max 180 KB per file). Binary/PDF/image attachments are not parsed in this version.
- The supplied Apple-inspired design tokens are preserved in brand.css and tailwind.config.js and are imported into the global Tailwind stylesheet.

## Local development

1. Use Node.js 20.9 or newer.
2. Install packages with npm install.
3. Copy .env.example to .env.local and add at least one server-side key: GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY.
4. Run npm run dev and open http://localhost:3000.
5. Run npm run typecheck and npm run lint before shipping.

## Vercel setup

Import this repository as a Next.js project, keep the framework preset as Next.js, and add provider keys in Project Settings → Environment Variables. At least one provider key is required for AI replies; keys are optional individually and only configured providers are considered. Redeploy after adding or changing variables.

Recommended server-side variables:

- OPENAI_API_KEY / OPENAI_MODEL
- GROQ_API_KEY / GROQ_MODEL
- ANTHROPIC_API_KEY / ANTHROPIC_MODEL
- GEMINI_API_KEY / GEMINI_MODEL

Use current model IDs enabled for your individual provider account. Defaults are centralized server-side and can be changed without modifying the UI. Never place provider keys in client bundles or variables prefixed with NEXT_PUBLIC_.

Optional integrations:

- ARCJET_KEY activates request shielding and server-side rate limits on the chat endpoint. Without this key, the endpoint still validates message shape and length, but Arcjet's protection is not active.
- NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST activate PostHog analytics. PostHog is disabled until a project token is supplied.
- Vercel Speed Insights is included; enable it from the Vercel dashboard if your project plan/settings require it.

## Scripts

- npm run dev — Next.js development server
- npm run build — production build
- npm start — production server
- npm run typecheck — strict TypeScript check
- npm run lint — Biome formatter/linter check

## Security and launch notes

The API keys are accessed only by server-side route code. Provider selection is never accepted from the browser. Requests are validated by Zod and limited in total context size. Arcjet is opt-in until an ARCJET_KEY is configured. Browser-local history is device-specific and is not a substitute for authenticated, persistent SaaS data. Before adding multi-user accounts, billing, file search, or team workspaces, add authentication, a database, per-user quotas, and durable abuse controls.

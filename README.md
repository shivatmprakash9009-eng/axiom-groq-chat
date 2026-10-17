# TIWAT

### Think clearly. Move faster.

TIWAT is an open-source, modern AI workspace for thinking, writing, research, and software development. It combines a focused chat interface with a server-side, multi-provider language-model router, streamed responses, conversation tools, configurable response styles, and account sign-in. The project is built with Next.js, React, and TypeScript, and is released under the MIT License.

<p align="center">
  <a href="https://axiom-groq-chat.vercel.app">Live application</a> ·
  <a href="https://github.com/shivatmprakash9009-eng/axiom-groq-chat/issues">Report an issue</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="SECURITY.md">Security policy</a>
</p>

<p align="center">
  <a href="https://github.com/shivatmprakash9009-eng/axiom-groq-chat/actions/workflows/build.yml"><img alt="Build and verification" src="https://github.com/shivatmprakash9009-eng/axiom-groq-chat/actions/workflows/build.yml/badge.svg?branch=main"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?logo=react">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript">
</p>

> **Project status:** TIWAT is actively evolving. Interfaces, provider routing, and configuration may change as the project develops. Review the current code and test your deployment before relying on it in production.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Current limitations](#current-limitations)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Configure Firebase Authentication](#configure-firebase-authentication)
- [Configure an AI provider](#configure-an-ai-provider)
- [Optional integrations](#optional-integrations)
- [Development and verification](#development-and-verification)
- [Deployment](#deployment)
- [Data, privacy, and security](#data-privacy-and-security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License and third-party notices](#license-and-third-party-notices)
- [Acknowledgements](#acknowledgements)

## Overview

TIWAT is built with the Next.js App Router and React. The browser provides the workspace experience; server routes validate chat requests, enforce rate limits, verify signed-in users, and call configured AI providers without sending provider secrets to the client.

The codebase is organized around a small number of explicit layers:

- **Workspace UI:** chat composition, history, settings, keyboard interactions, text-file attachments, and response rendering.
- **Chat API:** request validation, request IDs, rate limiting, Firebase ID-token verification for registered sessions, streaming, and JSON responses.
- **AI routing:** provider adapters for Google Gemini, Groq, OpenAI, and Anthropic.
- **Authentication:** Firebase Authentication for Google sign-in, email/password sign-in, account creation, and password-reset emails.
- **Browser storage:** conversation history is stored locally in the browser profile. It is not currently synchronized to a server-side conversation database.

TIWAT is an independent project. It is not an official product of Google, Groq, OpenAI, Anthropic, Vercel, or the maintainers of its framework dependencies.

## Features

### AI workspace

- **Multi-provider architecture:** adapters for Google Gemini, Groq, OpenAI, and Anthropic.
- **Provider fallback:** tries eligible configured providers in an order chosen by simple prompt-text heuristics; fallback is possible when an earlier provider fails before a streaming answer has begun.
- **Streaming responses:** Server-Sent Events (SSE) allow text to appear as it is generated.
- **Stop generation:** aborts the current browser request.
- **Response-style presets:** Balanced, Concise, In-depth, and Engineering.
- **Custom instructions:** workspace-specific instructions with a 2,000-character limit.
- **Temperature setting:** adjusts generation temperature within the accepted API range.
- **Markdown responses:** headings, lists, links, tables, and formatted prose.
- **Code blocks:** syntax highlighting, language labels, and copy-to-clipboard controls.
- **Text-file attachments:** reads supported text, code, CSV, JSON, Markdown, and configuration files up to 250 KB.
- **Prompt starters:** shortcuts for creative concepts, data analysis, summarization, and professional writing.

### Conversation tools

- Start a new conversation.
- Search conversations by title or message content.
- Browse history grouped by date.
- Rename, delete, or clear conversation history.
- Export the active conversation as Markdown or JSON.
- Edit a previous prompt by loading it back into the composer.
- Regenerate an assistant response.
- Give temporary in-UI thumbs-up/thumbs-down feedback.
- Use keyboard shortcuts for common tasks.

Authenticated conversation history supports up to 100 stored conversations in the workspace. The browser keeps a local cache, and signed-in history is synchronized through the server-side chat-history API. Cross-device sync depends on a correctly configured Supabase backend.

### Accounts and installation

- Firebase email/password sign-in and account creation.
- Google sign-in.
- Password-reset email flow.
- Firebase local session persistence.
- Authentication-gated workspace entry; a valid Firebase session is required for AI requests and cloud chat-history access.
- Responsive layout for desktop and mobile browsers.
- Progressive Web App (PWA) manifest and install prompt support where the browser supports installation.
- Light and dark appearance modes.
- Optional PostHog analytics, enabled when a PostHog key is configured.

### API and operational controls

- Validated request schemas using Zod.
- A request-correlation ID returned in the **x-request-id** response header.
- Rate limiting using Arcjet when configured, with an in-memory sliding-window fallback.
- A health endpoint at **/api/health** reporting whether providers are configured and which provider adapters have keys present.
- Automated CI checks for linting, TypeScript, unit tests, and production builds.

## Current limitations

The following details are important when evaluating or deploying the project:

- **Cloud history requires configuration:** signed-in history is stored through the server-side Supabase API, while a browser-local cache supports the workspace. Verify the deployed schema, service-role credentials, and sync behavior before relying on cross-device recovery.
- **Live web research requires a key:** the research toggle calls LangSearch through the server. Set `LANGSEARCH_API_KEY` in the deployment environment; having the UI control present does not prove the external service is available.
- **Attachments are text-only:** the current workflow reads supported text/code files. It does not implement native image understanding or a PDF/document extraction pipeline.
- **Math rendering is a limited custom renderer:** common symbols and simple expressions are supported; the component is not a complete LaTeX engine.
- **Response modes are style presets:** the provider/model is selected by server configuration and routing heuristics, not directly by the response-style control.
- **No arbitrary tool execution engine:** the chat route does not provide general-purpose code execution or unrestricted external actions.
- **Fallback rate limiting is in-memory:** it is not a distributed quota across serverless instances. Configure and verify an external limiter for production traffic.
- **Billing and SaaS foundations require live validation:** Stripe, Supabase quota accounting, and subscription transitions must be tested against correctly configured services before accepting paid users.
- **No production SLA is implied:** availability, provider limits, latency, and costs depend on your deployment and selected third-party services.

## Architecture

~~~mermaid
flowchart TD
    U[Browser / PWA] --> UI[TIWAT Workspace]
    UI --> AUTH[Firebase Authentication]
    UI --> API[Next.js POST /api/chat]
    API --> VALID[Zod Validation and Rate Limiting]
    VALID --> TOKEN[Verify Firebase ID Token for Signed-in Sessions]
    TOKEN --> ROUTER[AI Provider Router]
    ROUTER --> GEM[Google Gemini]
    ROUTER --> GRQ[Groq]
    ROUTER --> OAI[OpenAI]
    ROUTER --> ANT[Anthropic]
    GEM --> RESP[JSON or SSE Response]
    GRQ --> RESP
    OAI --> RESP
    ANT --> RESP
    RESP --> UI
    UI --> LOCAL[Browser localStorage for chat history]
~~~

### Request flow

1. The workspace sends the recent conversation messages and selected response settings to the Next.js chat route.
2. The server validates the bounded payload, applies rate limiting, and requires a valid Firebase ID token for AI requests.
3. The router ranks configured provider adapters using simple text-based rules and attempts them in sequence.
4. The selected provider returns either a normal response or streamed SSE chunks.
5. The workspace renders the answer, updates its local cache, and synchronizes signed-in conversation history through the server-side chat-history API.

The health endpoint is informational. A provider listed as configured means its environment key is present; it does not guarantee that the key is valid, that a model is available, or that a provider is currently healthy.

## Technology stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 19, TypeScript |
| Styling | Tailwind CSS v4, project CSS design tokens |
| Motion and icons | Framer Motion, Lucide React |
| UI state and navigation state | Zustand, nuqs |
| Forms and validation | React Hook Form, Zod |
| AI transport | Provider-specific HTTP adapters, JSON, Server-Sent Events |
| AI providers | Google Gemini, Groq, OpenAI, Anthropic |
| Authentication | Firebase Authentication |
| Optional edge/API protection | Arcjet |
| Optional analytics | PostHog |
| Linting | Biome |
| Tests | Node test runner through tsx |
| Hosting example | Vercel |

Exact library versions are maintained in **package.json** and the lockfile.

## Repository layout

~~~text
.
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Chat API: validation, auth, limits, streaming
│   │   └── health/route.ts        # Provider configuration health response
│   ├── chat/                      # Chat route
│   ├── landing/                   # Landing-page UI
│   ├── login/                     # Authentication screens
│   ├── privacy/                   # Privacy information page
│   ├── manifest.ts                # PWA manifest
│   ├── layout.tsx                 # Global layout, metadata, app providers
│   └── globals.css                # Global styles and design system
├── components/
│   ├── auth/                      # Firebase sign-in and account forms
│   ├── chat-workspace.tsx         # Main chat experience and local history
│   ├── code-block.tsx             # Code rendering and copy action
│   ├── settings-modal.tsx         # Response style, prompts, and diagnostics
│   ├── shortcuts-modal.tsx        # Keyboard shortcuts
│   ├── pwa-install-prompt.tsx      # Install guidance
│   └── providers.tsx              # Client-side providers
├── lib/
│   ├── ai/
│   │   ├── router.ts              # Base prompt, provider order, and fallback
│   │   ├── schema.ts              # Request and message validation
│   │   ├── types.ts               # Shared AI types
│   │   └── providers/             # Gemini, Groq, OpenAI, Anthropic adapters
│   ├── firebase/                  # Firebase web-auth initialization
│   └── security/                  # In-memory sliding-window rate limiter
├── stores/
│   └── ui-store.ts                # Workspace appearance and settings state
├── tests/                         # Router, schema, and rate-limiter tests
├── .github/workflows/build.yml    # CI verification workflow
├── .env.example                   # Environment variable reference
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE
~~~

## Quick start

### Prerequisites

- Node.js 22 or newer.
- npm.
- At least one API key for a supported AI provider.
- A Firebase project configured for account sign-in (email/password and/or Google).

### 1. Clone the repository

~~~bash
git clone https://github.com/shivatmprakash9009-eng/axiom-groq-chat.git
cd axiom-groq-chat
~~~

### 2. Install dependencies

~~~bash
npm install
~~~

For a clean CI-style install, use **npm ci** when the lockfile matches the package manifest.

### 3. Create your local environment file

~~~bash
cp .env.example .env.local
~~~

Add at least one server-side provider key. For the complete signed-in experience, also configure the Firebase web-app variables and Firebase Authentication providers.

**Never commit .env.local or real API credentials.** The **.env.example** file is a template, not a place to put working secrets.

### 4. Start the development server

~~~bash
npm run dev
~~~

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy the variable names from **.env.example**. Configure only the integrations you intend to use.

| Variable | Required? | Purpose |
| --- | --- | --- |
| **GROQ_API_KEY** | At least one provider key is required | Server-side credential for Groq. |
| **GROQ_MODEL** | Optional | Model ID for the Groq adapter. |
| **GEMINI_API_KEY** | Optional provider | Server-side credential for Google Gemini. |
| **GEMINI_MODEL** | Optional | Model ID for the Gemini adapter. |
| **OPENAI_API_KEY** | Optional provider | Server-side credential for OpenAI. |
| **OPENAI_MODEL** | Optional | Model ID for the OpenAI adapter. |
| **ANTHROPIC_API_KEY** | Optional provider | Server-side credential for Anthropic. |
| **ANTHROPIC_MODEL** | Optional | Model ID for the Anthropic adapter. |
| **DEFAULT_MODEL** | Optional | Fallback model ID consulted by the Groq adapter when GROQ_MODEL is unset. |
| **ARCJET_KEY** | Optional | Enables Arcjet shield and fixed-window rate-limiting rules. Without it, the route uses the in-memory sliding-window limiter. |
| **NEXT_PUBLIC_SITE_URL** | Optional | Public base URL used for site metadata. Defaults to the deployed TIWAT URL. |
| **NEXT_PUBLIC_FIREBASE_API_KEY** | Required for Firebase auth | Firebase web-app configuration value. It is visible to the browser by design; restrict it in Google Cloud/Firebase settings and do not treat it as a server secret. |
| **NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN** | Required for Firebase auth | Firebase Authentication domain. |
| **NEXT_PUBLIC_FIREBASE_PROJECT_ID** | Required for Firebase auth | Firebase project ID. |
| **NEXT_PUBLIC_FIREBASE_APP_ID** | Required for Firebase auth | Firebase web-app ID. |
| **NEXT_PUBLIC_POSTHOG_KEY** | Optional | Enables PostHog analytics initialization. |
| **NEXT_PUBLIC_POSTHOG_HOST** | Optional | PostHog host; defaults to the configured US endpoint in the analytics component. |

Provider keys such as **GROQ_API_KEY**, **GEMINI_API_KEY**, **OPENAI_API_KEY**, and **ANTHROPIC_API_KEY** must stay server-side. Do not prefix them with **NEXT_PUBLIC_**.

Model IDs accepted by third-party providers can change. Check each provider’s current documentation and your account access before selecting a model.

## Configure Firebase Authentication

1. Create or open a project in the Firebase console.
2. Add a Web App and copy its API key, auth domain, project ID, and app ID to **.env.local**.
3. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**.
4. In Firebase Authentication settings, add your local development hostname and production hostname to **Authorized domains**.
5. Restart the development server after changing environment variables.
6. Test account creation, sign-in, sign-out, password reset, and Google sign-in in the deployed domain.

For production, review allowed domains, API restrictions, authentication settings, and applicable Google/Firebase policies. Never deploy with another developer’s Firebase configuration.

## Configure an AI provider

Choose one or more providers:

- **Groq:** set **GROQ_API_KEY** and, if needed, **GROQ_MODEL**.
- **Google Gemini:** set **GEMINI_API_KEY** and, if needed, **GEMINI_MODEL**.
- **OpenAI:** set **OPENAI_API_KEY** and, if needed, **OPENAI_MODEL**.
- **Anthropic:** set **ANTHROPIC_API_KEY** and, if needed, **ANTHROPIC_MODEL**.

The router only considers providers whose keys are present. It uses a small set of keyword and language heuristics to rank candidates; it is not a benchmark-driven model selector. Requests may be sent to a subsequent configured provider when an earlier attempt fails, so review each provider’s data-handling terms and billing before enabling several providers.

## Optional integrations

### Arcjet

Set **ARCJET_KEY** to enable the Arcjet protection path configured in the API route. Without it, TIWAT uses the in-memory sliding-window limiter. The fallback limiter is not a distributed quota system and should not be treated as sufficient protection for a multi-instance production deployment.

### PostHog

Set **NEXT_PUBLIC_POSTHOG_KEY** and optionally **NEXT_PUBLIC_POSTHOG_HOST** to enable analytics initialization. The current analytics component enables page-view/page-leave capture, autocapture, and session recording with input-masking settings. Before enabling analytics for public users, review your disclosure, consent, retention, access-control, and applicable privacy requirements in the PostHog project and your deployment jurisdiction.

## Development and verification

Run the quality checks before submitting a change:

~~~bash
npm run lint
npm run typecheck
npm test
npm run build
~~~

Available scripts:

| Command | Description |
| --- | --- |
| **npm run dev** | Starts the local development server on port 3000. |
| **npm run build** | Creates the production build. |
| **npm run start** | Starts the production server on port 3000 after building. |
| **npm run lint** | Runs Biome checks. |
| **npm run lint:fix** | Applies supported Biome fixes. |
| **npm run typecheck** | Runs the TypeScript compiler without emitting files. |
| **npm test** | Runs the automated test suite. |

GitHub Actions runs lint, typecheck, tests, and a production build for pull requests targeting **main** and configured branch pushes. Confirm the latest workflow result instead of assuming a change passed.

## Deployment

The repository is configured for Next.js and includes Vercel deployment through the connected Git repository.

1. Import the repository into Vercel or use the already connected Vercel project.
2. Configure environment variables in the correct Vercel environments (Development, Preview, and Production as needed).
3. Make sure the Firebase production domain is authorized.
4. Deploy the **main** branch.
5. Wait for the build to finish and confirm the deployment is **Ready**.
6. Test authentication, chat streaming, provider configuration, and **/api/health** on the actual production hostname.

Useful endpoints:

- App: [axiom-groq-chat.vercel.app](https://axiom-groq-chat.vercel.app)
- Health: [axiom-groq-chat.vercel.app/api/health](https://axiom-groq-chat.vercel.app/api/health)
- Chat endpoint: **POST /api/chat**

The health endpoint reports configuration state, active provider names, rate-limiter mode, version, and timestamp. It does not call each provider to prove live availability.

## Data, privacy, and security

TIWAT processes user messages using external model providers. Do not submit passwords, API keys, access tokens, financial credentials, or sensitive information that you do not want transmitted to a configured provider.

### Current data handling

- **Authentication:** Firebase Authentication handles account identity and sessions.
- **Conversation history:** Signed-in chat history is stored through the authenticated server-side Supabase API and cached in the browser profile. Cross-device recovery depends on valid Supabase configuration and successful synchronization.
- **Authentication:** AI requests and cloud-history endpoints require a verified Firebase ID token. Browser-local caches should still be cleared on shared devices when appropriate.
- **AI providers:** Prompts and included text attachment contents are sent to the selected configured provider. If the router retries after a failure, another configured provider may also receive that request.
- **Analytics:** PostHog starts only when an analytics key is configured. When enabled, the current code turns on autocapture and session recording; configure and disclose this appropriately before public use.
- **Application configuration:** Firebase web-app values use the **NEXT_PUBLIC_** prefix and are delivered to the browser. They are public configuration, not substitutes for server-side secrets.

### Security controls in the current code

- Zod validates chat request shape and bounds messages, message length, total context, style, temperature, and custom instructions.
- Registered chat API requests are checked by verifying the supplied Firebase ID token with Firebase Identity Toolkit.
- Server-side provider keys are read from environment variables.
- Rate limiting is enabled through Arcjet when configured or through an in-memory fallback.
- Common response security headers are configured in **next.config.ts**.
- API request correlation IDs support diagnostics without requiring client exposure of provider keys.

These controls are not a guarantee that every deployment is secure. Review deployment permissions, logging, provider settings, Firebase restrictions, rate limits, dependencies, and applicable data-protection requirements before commercial or high-risk use.

For vulnerability reporting, see [SECURITY.md](SECURITY.md). Do not publish exploit details or credentials in a public issue.

## Troubleshooting

### “TIWAT is not connected to an AI provider”

Set at least one supported server-side provider key in the deployment environment, then redeploy or restart the development server.

### Provider authentication, model, or rate-limit errors

Verify the selected provider key, model identifier, account permissions, available quota, and provider status. Check deployment logs using the request ID if available. A key being present in **/api/health** does not prove that it is valid.

### Google sign-in does not work

- Enable Google as a Firebase sign-in provider.
- Add the exact hostname to Firebase Authentication’s authorized domains.
- Confirm all four **NEXT_PUBLIC_FIREBASE_*** values match the same Firebase Web App.
- Check browser popup settings and review the precise Firebase error code.
- Redeploy after changing production environment variables.

### Chat history is missing on another device

This is expected in the current implementation. Conversation history is stored in local storage on the browser profile and is not synced to an account database. Export important chats as Markdown or JSON before clearing browser data.

### Rate limiting behaves differently after deployment

The in-memory fallback is per running server process and may not be shared across serverless instances. Configure Arcjet or another suitable shared rate-limiting service for production.

### Build or TypeScript failure

Use Node.js 22 or newer, install dependencies from the lockfile, and run the verification commands locally. Read the first actionable error, fix it, and rerun the full checks.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), follow the [Code of Conduct](CODE_OF_CONDUCT.md), and run the quality checks before opening a pull request.

For reproducible bugs, include the steps to reproduce, expected and actual behavior, environment details, and relevant non-secret logs. Never attach API keys, Firebase tokens, user conversations, or other private data.

## License and third-party notices

TIWAT’s original source code is distributed under the **MIT License**. See [LICENSE](LICENSE) for the full terms.

The MIT License does not grant rights to third-party trademarks or assets, and it does not replace the terms or privacy policies of external services. Third-party packages remain subject to their own licenses. Google Firebase, Gemini, Groq, OpenAI, Anthropic, Vercel, PostHog, Arcjet, and other named products and marks belong to their respective owners. Their mention here does not imply endorsement or affiliation.

## Acknowledgements

TIWAT is built on the work of the open-source ecosystem, including Next.js, React, TypeScript, Tailwind CSS, Zustand, Zod, React Hook Form, Framer Motion, Lucide, Biome, and the other maintainers whose libraries make this project possible.

**Built to help people think clearly and move faster.**
